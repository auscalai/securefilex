const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const schedule = require('node-schedule');
const Busboy = require('busboy');
const express = require('express');
const http = require('http');
const https = require('https');
const request = require('request');
const tmp = require('tmp');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

try {
    const sjclPath = require.resolve('sjcl');
    vm.runInThisContext(fs.readFileSync(sjclPath, 'utf8'));
    global.sjcl = sjcl;
    require('sjcl/core/random.js');
    require('sjcl/core/codecHex.js');
    require('sjcl/core/bn.js');
    require('sjcl/core/ecc.js');
} catch (e) {
    console.error("CRITICAL: Failed to load 'sjcl' modules.", e.message);
    process.exit(1);
}

// --- Path Helpers ---
const ident_path = (ident) => path.join(__dirname, '../i/', path.basename(ident));
const meta_path = (ident) => path.join(__dirname, '../meta/', `${path.basename(ident)}.json`);
const ident_exists = (ident) => fs.existsSync(ident_path(ident));

// --- ECC Key Management ---
const keyPairPath = path.join(__dirname, 'ecc_keys.json');
let eccKeyPair = null;

function getECCKeys() {
    if (eccKeyPair) return eccKeyPair;
    try {
        const keyData = JSON.parse(fs.readFileSync(keyPairPath, 'utf8'));
        eccKeyPair = {
            pub: new sjcl.ecc.elGamal.publicKey(sjcl.ecc.curves.c256, sjcl.codec.base64.toBits(keyData.pub)),
            sec: new sjcl.ecc.elGamal.secretKey(sjcl.ecc.curves.c256, sjcl.bn.fromBits(sjcl.codec.hex.toBits(keyData.sec)))
        };
        console.log("ECC keys loaded successfully.");
        return eccKeyPair;
    } catch (e) {
        console.warn(`Warning: Could not load ${keyPairPath}. Generating new ECC key pair...`);
        const newKeyPair = sjcl.ecc.elGamal.generateKeys(sjcl.ecc.curves.c256);
        const keysToSave = {
            pub: sjcl.codec.base64.fromBits(newKeyPair.pub.get().x.concat(newKeyPair.pub.get().y)),
            sec: sjcl.codec.hex.fromBits(newKeyPair.sec.get())
        };
        try {
            fs.writeFileSync(keyPairPath, JSON.stringify(keysToSave, null, 2));
            console.log(`New ECC keys saved to ${keyPairPath}`);
            eccKeyPair = newKeyPair;
            return eccKeyPair;
        } catch (saveError) {
            console.error("CRITICAL: Failed to save new ECC keys!", saveError);
            process.exit(1);
        }
    }
}

function get2FAProtectedFile(ident, expectedMagic) {
    return new Promise((resolve, reject) => {
        try {
            const filePath = ident_path(ident);
            const fileStats = fs.statSync(filePath);
            const fd = fs.openSync(filePath, 'r');

            const footerBuffer = Buffer.alloc(8);
            fs.readSync(fd, footerBuffer, 0, 8, fileStats.size - 8);
            const magic = footerBuffer.toString('utf8', 0, 4);

            if (magic !== expectedMagic) {
                fs.closeSync(fd);
                return reject(new Error(`File is not marked for ${expectedMagic} auth.`));
            }

            const dataLength = footerBuffer.readUInt32BE(4);
            const dataBuffer = Buffer.alloc(dataLength);
            fs.readSync(fd, dataBuffer, 0, dataLength, fileStats.size - 8 - dataLength);
            fs.closeSync(fd);
            
            const encryptedJson = dataBuffer.toString('utf8');
            const decryptedSecret = sjcl.decrypt(getECCKeys().sec, encryptedJson);

            resolve({ fileStats, decryptedSecret, dataLength });
        } catch (err) {
            reject(err);
        }
    });
}

// --- Main Application ---
function create_app(config) {
    const app = express();
    app.locals.config = config;
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use('', express.static(config.path.client));
    app.use('/i', express.static(config.path.i));

    app.post('/up', (req, res) => {
        const busboy = new Busboy({ headers: req.headers, limits: { files: 1, parts: 3 } });
        let fields = {};
        let tmpfname = null;

        busboy.on('field', (fieldname, value) => fields[fieldname] = value);

        busboy.on('file', (fieldname, file) => {
            if (fieldname !== 'file') return file.resume();
            try {
                const ftmp = tmp.fileSync({ postfix: '.tmp', dir: config.path.i, keep: true });
                tmpfname = ftmp.name;
                file.pipe(fs.createWriteStream('', { fd: ftmp.fd }));
            } catch (err) {
                console.error("Error creating temp file:", err);
                res.status(500).send("Server Error");
            }
        });

        busboy.on('finish', () => {
            if (!tmpfname || fields.api_key !== config['api_key'] || !fields.ident || fields.ident.length !== 22) {
                return res.status(400).json({ error: "Invalid request parameters." });
            }
            if (ident_exists(fields.ident)) {
                return res.status(409).json({ error: "Ident is already taken." });
            }
            
            const finalPath = ident_path(fields.ident);
            fs.rename(tmpfname, finalPath, (err) => {
                if (err) {
                    console.error("Error renaming file:", err);
                    return res.status(500).send("Server Error");
                }
                fs.stat(finalPath, (statErr, stats) => {
                    if (statErr) {
                        console.error(`File not available after rename for ident ${fields.ident}:`, statErr);
                        return res.status(500).send("Server Error");
                    }
                    const delhmac = crypto.createHmac('sha256', config.delete_key).update(fields.ident).digest('hex');
                    res.json({ delkey: delhmac });
                });
            });
        });
        req.pipe(busboy);
    });

    app.get('/del', (req, res) => {
        const { ident, delkey } = req.query;
        if (!ident || !delkey || ident.length !== 22) {
            return res.status(400).json({ error: "Invalid parameters" });
        }
        
        const expectedDelkey = crypto.createHmac('sha256', config.delete_key).update(ident).digest('hex');
        if (delkey !== expectedDelkey) {
            return res.status(403).json({ error: "Incorrect delete key" });
        }
        if (!ident_exists(ident)) {
            return res.status(404).json({ error: "Ident does not exist" });
        }

        fs.unlink(ident_path(ident), (err) => {
            if (err) {
                console.error("Error deleting file:", err);
                return res.status(500).send("Error deleting file");
            }
            fs.unlink(meta_path(ident), () => {});
            res.redirect('/');
        });
    });

    app.post('/set_expiry/:ident', (req, res) => {
        const { ident } = req.params;
        const { delkey, duration } = req.body;
        const durationHours = parseFloat(duration);
        
        const MAX_HOURS = 30 * 24;
        if (!ident || !delkey || isNaN(durationHours) || durationHours <= 0 || durationHours > MAX_HOURS) {
            return res.status(400).json({ error: "Invalid parameters or duration out of range." });
        }
        if (!ident_exists(ident)) {
            return res.status(404).json({ error: "Ident does not exist." });
        }

        const expectedDelkey = crypto.createHmac('sha256', config.delete_key).update(ident).digest('hex');
        if (delkey !== expectedDelkey) {
            return res.status(403).json({ error: "Invalid delete key." });
        }

        const expiresAt = Date.now() + (durationHours * 60 * 60 * 1000);
        fs.writeFile(meta_path(ident), JSON.stringify({ expiresAt }), (err) => {
            if (err) {
                console.error("Error writing metadata:", err);
                return res.status(500).json({ error: "Could not save expiration data." });
            }
            res.status(200).json({ message: "Expiry set." });
        });
    });

    // --- 2FA Endpoints ---
    app.get('/public_key', (req, res) => {
        try {
            const pubKey = getECCKeys().pub.get();
            res.json({ key: sjcl.codec.base64.fromBits(pubKey.x.concat(pubKey.y)) });
        } catch (e) {
            res.status(500).json({ error: "Could not retrieve public key." });
        }
    });

    app.get('/check_auth_type/:ident', (req, res) => {
        const filePath = ident_path(req.params.ident);
        fs.stat(filePath, (err, stats) => {
            if (err || stats.size < 8) return res.json({ authType: 'none' });
            
            const stream = fs.createReadStream(filePath, { start: stats.size - 8 });
            let footer = Buffer.alloc(0);
            stream.on('data', chunk => footer = Buffer.concat([footer, chunk]));
            stream.on('end', () => {
                const magic = footer.toString('utf8', 0, 4);
                if (magic === "FACE") return res.json({ authType: 'face' });
                if (magic === "TOTP") return res.json({ authType: 'totp' });
                return res.json({ authType: 'none' });
            });
            stream.on('error', () => res.json({ authType: 'none' }));
        });
    });

    app.post('/verify_face_setup', (req, res) => {
        const { faceDataUri } = req.body;
        if (!faceDataUri) {
            return res.status(400).json({ valid: false, error: "No face data provided." });
        }

        const deepfaceConfig = req.app.locals.config.deepface;

        // Use the same image for both inputs to check for validity and liveness
        const deepFacePayload = {
            "img1": faceDataUri,
            "img2": faceDataUri,
            "model_name": deepfaceConfig.model_name,
            "detector_backend": deepfaceConfig.detector_backend,
            "distance_metric": deepfaceConfig.distance_metric,
            "anti_spoofing": deepfaceConfig.anti_spoofing,
            "align": deepfaceConfig.align,
            "enforce_detection": deepfaceConfig.enforce_detection
        };

        const requestOptions = {
            url: deepfaceConfig.url,
            json: deepFacePayload,
            timeout: deepfaceConfig.timeout
        };

        request.post(requestOptions, (err, _, body) => {
            if (err) {
                console.error("DeepFace setup check request error:", err.message);
                return res.status(500).json({ valid: false, error: "Verification server is unavailable." });
            }

            // If 'verified' is true, it means a face was detected and it passed any other checks (like anti-spoofing).
            if (body?.verified === true) {
                res.json({ valid: true });
            } else {
                // Provide a more user-friendly error based on the DeepFace response
                let userError = "Face could not be validated.";
                if (body?.error) {
                    if (body.error.includes("Spoof detected")) {
                        userError = "Spoof detected. Please use a live camera feed.";
                    } else if (body.error.includes("Face could not be detected")) {
                        userError = "No clear face was detected. Please try again.";
                    }
                }
                res.status(400).json({ valid: false, error: userError });
            }
        });
    });

    app.post('/verify_face/:ident', async (req, res) => {
        const { ident } = req.params;
        const { faceDataUri: newFaceDataUri } = req.body;
        if (!newFaceDataUri) return res.status(400).json({ error: "No face data provided." });

        try {
            const { fileStats, decryptedSecret: originalFaceDataUri, dataLength } = await get2FAProtectedFile(ident, 'FACE');
            

            const deepfaceConfig = req.app.locals.config.deepface;

            const deepFacePayload = {
                "img1": originalFaceDataUri,
                "img2": newFaceDataUri,
                "model_name": deepfaceConfig.model_name,
                "detector_backend": deepfaceConfig.detector_backend,
                "distance_metric": deepfaceConfig.distance_metric,
                "anti_spoofing": deepfaceConfig.anti_spoofing,
                "align": deepfaceConfig.align,
                "enforce_detection": deepfaceConfig.enforce_detection
            };

            const requestOptions = {
                url: deepfaceConfig.url,
                json: deepFacePayload,
                timeout: deepfaceConfig.timeout
            };

            request.post(requestOptions, (err, _, body) => {
                if (err) {
                    console.error("DeepFace request error:", err.message);
                    return res.status(500).json({ error: "Verification server error." });
                }
                if (body?.error) {
                    let userError = body.error.includes("Spoof detected") ? "Spoof detected." : "Face could not be detected.";
                    return res.status(403).json({ error: userError });
                }
                if (body?.verified === true) {
                    const mainFileSize = fileStats.size - 8 - dataLength;
                    res.setHeader('Content-Type', 'application/octet-stream');
                    fs.createReadStream(ident_path(ident), { end: mainFileSize - 1 }).pipe(res);
                } else {
                    res.status(403).json({ error: "Face does not match." });
                }
            });
        } catch (error) {
            console.error("Face verification processing error:", error.message);
            res.status(500).json({ error: "Failed to process face verification." });
        }
    });

    app.post('/verify_totp/:ident', async (req, res) => {
        const { ident } = req.params;
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "No TOTP token provided." });

        try {
            const { fileStats, decryptedSecret: totpSecret, dataLength } = await get2FAProtectedFile(ident, 'TOTP');
            const verified = speakeasy.totp.verify({ secret: totpSecret, encoding: 'base32', token, window: 0 });
            
            if (verified) {
                const mainFileSize = fileStats.size - 8 - dataLength;
                res.setHeader('Content-Type', 'application/octet-stream');
                fs.createReadStream(ident_path(ident), { end: mainFileSize - 1 }).pipe(res);
            } else {
                res.status(403).json({ error: "Invalid TOTP code." });
            }
        } catch (error) {
            res.status(500).json({ error: "Failed to process TOTP verification." });
        }
    });

    return app;
}

// --- Server Initialization ---
function startCleanupJob(config) {
    schedule.scheduleJob('*/5 * * * *', () => {
        console.log(`[${new Date().toISOString()}] Running cleanup job...`);
        const metaDir = path.resolve(__dirname, config.path.meta);
        const filesDir = path.resolve(__dirname, config.path.i);

        fs.readdir(metaDir, (err, files) => {
            if (err) return console.error("Cleanup error:", err);
            
            files.forEach(file => {
                if (path.extname(file) !== '.json') return;
                
                const metaPath = path.join(metaDir, file);
                fs.readFile(metaPath, 'utf8', (readErr, content) => {
                    if (readErr) return;
                    try {
                        if (Date.now() > JSON.parse(content).expiresAt) {
                            const ident = path.basename(file, '.json');
                            console.log(`File ${ident} has expired. Deleting...`);
                            fs.unlink(path.join(filesDir, ident), () => {});
                            fs.unlink(metaPath, () => {});
                        }
                    } catch (parseErr) {}
                });
            });
        });
    });
}

function init(config) {
    const defaultDeepFaceConfig = {
        url: "http://localhost:5000/verify",
        timeout: 10000,
        model_name: "Facenet",
        detector_backend: "opencv",
        distance_metric: "cosine",
        anti_spoofing: true,
        align: true,
        enforce_detection: true
    };
    
    config.deepface = Object.assign({}, defaultDeepFaceConfig, config.deepface);
    config.path = {
        i: config.path?.i || "../i",
        meta: config.path?.meta || "../meta",
        client: config.path?.client || "../client"
    };
    config.http = config.http || { enabled: true, listen: ":80" };
    config.https = config.https || { enabled: false };
    
    fs.mkdirSync(path.resolve(__dirname, config.path.meta), { recursive: true });

    getECCKeys();
    const app = create_app(config);

    if (config.http.enabled) {
        const { host, port } = Object.assign({ host: undefined, port: 80 }, get_addr_port(config.http.listen));
        http.createServer(app).listen(port, host, () => console.info(`HTTP server at http://${host || 'localhost'}:${port}`));
    }
    if (config.https.enabled && config.https.key && config.https.cert) {
        try {
            const creds = { key: fs.readFileSync(config.https.key), cert: fs.readFileSync(config.https.cert) };
            const { host, port } = Object.assign({ host: undefined, port: 443 }, get_addr_port(config.https.listen));
            https.createServer(creds, app).listen(port, host, () => console.info(`HTTPS server at https://${host || 'localhost'}:${port}`));
        } catch (e) {
            console.error("Could not start HTTPS server.", e.message);
        }
    }
    
    startCleanupJob(config);
}

function get_addr_port(s) {
    const spl = s.split(":");
    return spl.length === 1 ? { host: spl[0] } : { host: spl[0] || undefined, port: parseInt(spl[1]) };
}

const configPath = process.argv.length > 2 ? process.argv[2] : './server.conf';
try {
    init(JSON.parse(fs.readFileSync(path.resolve(__dirname, configPath))));
} catch (err) {
    console.error(`Error loading config file "${configPath}":`, err.message);
    process.exit(1);
}