var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

try {
    const sjclPath = require.resolve('sjcl');
    const sjclFileContent = fs.readFileSync(sjclPath, 'utf8');
    vm.runInThisContext(sjclFileContent);
    global.sjcl = sjcl;
    require('sjcl/core/random.js');
    require('sjcl/core/codecHex.js');
    require('sjcl/core/bn.js');
    require('sjcl/core/ecc.js');
} catch (e) {
    console.error("CRITICAL: Failed to load 'sjcl/core' modules.", e.message);
    process.exit(1);
}

var Busboy = require('busboy');
var express = require('express');
var http = require('http');
var https = require('https');
var request = require('request');
var tmp = require('tmp');
var speakeasy = require('speakeasy');
var QRCode = require('qrcode');

function handle_upload(req, res) {
    var config = req.app.locals.config
    var busboy = new Busboy({
        headers: req.headers,
        limits: { files: 1, parts: 3 }
    });
    var fields = {};
    var tmpfname = null;

    busboy.on('field', function(fieldname, value) {
        fields[fieldname] = value;
    });

    busboy.on('file', function(fieldname, file, filename) {
        if (fieldname !== 'file') {
            file.resume();
            return;
        }
        try {
            var ftmp = tmp.fileSync({ postfix: '.tmp', dir: req.app.locals.config.path.i, keep: true });
            tmpfname = ftmp.name;
            var fstream = fs.createWriteStream('', {fd: ftmp.fd, defaultEncoding: 'binary'});
            file.pipe(fstream);
        } catch (err) {
            console.error("Error creating temp file:", err);
            res.status(500).send("Internal Server Error");
            req.unpipe(busboy);
            res.close();
        }
    });

    busboy.on('finish', function() {
        try {
            if (!tmpfname) {
                res.status(500).send("Internal Server Error");
            } else if (fields.api_key !== config['api_key']) {
                res.status(403).json({error: "API key doesn't match", code: 2});
            } else if (!fields.ident) {
                res.status(400).json({error: "Ident not provided", code: 11});
            } else if (fields.ident.length !== 22) {
                res.status(400).json({error: "Ident length is incorrect", code: 3});
            } else if (ident_exists(fields.ident)) {
                res.status(409).json({error: "Ident is already taken.", code: 4});
            } else {
                var delhmac = crypto.createHmac('sha256', config.delete_key)
                                    .update(fields.ident)
                                    .digest('hex');
                fs.rename(tmpfname, ident_path(fields.ident), function(err) {
                    if (err) {
                         console.error("Error renaming file:", err);
                         return res.status(500).send("Internal Server Error");
                    }
                    res.json({delkey: delhmac});
                });
            }
        } catch (err) {
            console.error("Error in busboy finish:", err);
            res.status(500).send("Internal Server Error");
        }
    });
    return req.pipe(busboy);
};

function handle_delete(req, res) {
    var config = req.app.locals.config
    if (!req.query.ident) {
        return res.status(400).json({error: "Ident not provided", code: 11});
    }
    if (!req.query.delkey) {
        return res.status(400).json({error: "Delete key not provided", code: 12});
    }
    var delhmac = crypto.createHmac('sha256', config.delete_key)
                        .update(req.query.ident)
                        .digest('hex');

    if (req.query.ident.length !== 22) {
        res.status(400).json({error: "Ident length is incorrect", code: 3});
    } else if (delhmac !== req.query.delkey) {
        res.status(403).json({error: "Incorrect delete key", code: 10});
    } else if (!ident_exists(req.query.ident)) {
        res.status(404).json({error: "Ident does not exist", code: 9});
    } else {
        fs.unlink(ident_path(req.query.ident), function(err) {
            if (err) {
                console.error("Error deleting file:", err);
                return res.status(500).send("Error deleting file");
            }
            cf_invalidate(req.query.ident, config);
            res.redirect('/');
        });
    }
};

function ident_path(ident) {
    const safeIdent = path.basename(ident);
    if (safeIdent !== ident) {
        throw new Error("Invalid ident format.");
    }
    return path.join(__dirname, '../i/', safeIdent);
}

function ident_exists(ident) {
    try {
        fs.lstatSync(ident_path(ident));
        return true;
    } catch (err) {
        return false;
    }
}

function cf_do_invalidate(ident, mode, cfconfig) {
    var inv_url = mode + '://' + cfconfig.url + '/i/' + ident;
    request.post({
        url: 'https://www.cloudflare.com/api_json.html',
        form: { a: 'zone_file_purge', tkn: cfconfig.token, email: cfconfig.email, z: cfconfig.domain, url: inv_url }
    }, function(err, response, body) {
        if (err) { return console.warn("Cloudflare invalidation error:", err); }
        try {
            var result = JSON.parse(body)
            if (result.result === 'error') {
                 console.warn("Cloudflare invalidation failed:", result.msg);
            }
        } catch(err) {
            console.warn("Error parsing Cloudflare response:", body);
        }
    });
}

function cf_invalidate(ident, config) {
    if (!config['cloudflare-cache-invalidate']) return;
    var cfconfig = config['cloudflare-cache-invalidate']
    if (!cfconfig.enabled) return;
    if (config.http.enabled) cf_do_invalidate(ident, 'http', cfconfig);
    if (config.https.enabled) cf_do_invalidate(ident, 'https', cfconfig);
}

const keyPairPath = path.join(__dirname, 'ecc_keys.json');
let eccKeyPair = null;

function getECCKeys() {
    if (eccKeyPair) return eccKeyPair;
    try {
        const keyData = fs.readFileSync(keyPairPath, 'utf8');
        const keys = JSON.parse(keyData);
        const pub = new sjcl.ecc.elGamal.publicKey(sjcl.ecc.curves.c256, sjcl.codec.base64.toBits(keys.pub));
        const sec = new sjcl.ecc.elGamal.secretKey(sjcl.ecc.curves.c256, sjcl.bn.fromBits(sjcl.codec.hex.toBits(keys.sec)));
        eccKeyPair = { pub: pub, sec: sec };
        console.log("ECC keys loaded successfully.");
        return eccKeyPair;
    } catch (e) {
        console.warn(`Warning: Could not load ${keyPairPath}. Generating new ECC key pair...`);
        const keyPair = sjcl.ecc.elGamal.generateKeys(sjcl.ecc.curves.c256);
        const keysToSave = {
            pub: sjcl.codec.base64.fromBits(keyPair.pub.get().x.concat(keyPair.pub.get().y)),
            sec: sjcl.codec.hex.fromBits(keyPair.sec.get())
        };
        try {
            fs.writeFileSync(keyPairPath, JSON.stringify(keysToSave, null, 2));
            console.log(`New ECC keys saved to ${keyPairPath}`);
            eccKeyPair = keyPair;
            return eccKeyPair;
        } catch (saveError) {
            console.error("CRITICAL: Failed to save new ECC keys!", saveError);
            process.exit(1);
        }
    }
}

function create_app(config) {
  var app = express();
  app.locals.config = config;
  app.use(express.json({ limit: '5mb' }));
  
  app.use('', express.static(config.path.client));
  app.use('/i', express.static(config.path.i));
  
  app.post('/up', handle_upload);
  app.get('/del', handle_delete);

  app.get('/public_key', (req, res) => {
    try {
        const keys = getECCKeys();
        const pubKeyPoint = keys.pub.get();
        const pubKeyBase64 = sjcl.codec.base64.fromBits(pubKeyPoint.x.concat(pubKeyPoint.y));
        res.json({ curve: 'c256', key: pubKeyBase64 });
    } catch (e) {
        console.error("Error getting public key:", e);
        res.status(500).json({ error: "Could not retrieve public key." });
    }
  });

  app.get('/generate_totp', (req, res) => {
    try {
        const secret = speakeasy.generateSecret({ name: 'SecureFile Locker', length: 32 });
        QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
            if (err) {
                console.error("Error generating QR code:", err);
                return res.status(500).json({ error: "Could not generate QR code." });
            }
            res.json({ secret: secret.base32, qrCode: dataUrl });
        });
    } catch (e) {
        console.error("Error generating TOTP secret:", e);
        res.status(500).json({ error: "Could not generate TOTP secret." });
    }
  });

  app.post('/verify_totp_setup', (req, res) => {
    try {
        const { secret, token } = req.body;
        if (!secret || !token) {
            return res.status(400).json({ valid: false, error: "Missing secret or token." });
        }
        const verified = speakeasy.totp.verify({ secret: secret, encoding: 'base32', token: token, window: 2 });
        res.json({ valid: verified });
    } catch (e) {
        console.error("Error verifying TOTP:", e);
        res.status(500).json({ valid: false, error: "Verification error." });
    }
  });

  app.get('/check_auth_type/:ident', (req, res) => {
    try {
        const ident = req.params.ident;
        if (!ident || ident.length !== 22 || path.basename(ident) !== ident) {
            return res.status(400).json({ error: "Invalid ident" });
        }
        const filePath = ident_path(ident);
        
        fs.stat(filePath, (statErr, stats) => {
            if (statErr || stats.size < 8) {
                return res.json({ authType: 'none' });
            }
            const stream = fs.createReadStream(filePath, { start: stats.size - 8 });
            let footer = Buffer.alloc(0);
            stream.on('data', (chunk) => footer = Buffer.concat([footer, chunk]));
            stream.on('end', () => {
                if (footer.length === 8) {
                    const magic = footer.toString('utf8', 0, 4);
                    if (magic === "FACE") return res.json({ authType: 'face' });
                    if (magic === "TOTP") return res.json({ authType: 'totp' });
                }
                return res.json({ authType: 'none' });
            });
            stream.on('error', (err) => {
                console.error("Error reading file footer:", err);
                return res.json({ authType: 'none' });
            });
        });
    } catch (e) {
        res.status(500).json({ authType: 'none', error: "Server error" });
    }
  });

  app.post('/verify_face/:ident', (req, res) => {
    const ident = req.params.ident;
    const newFaceDataUri = req.body.faceDataUri;

    if (!newFaceDataUri) return res.status(400).json({ verified: false, error: "No face data provided." });
    if (!ident || ident.length !== 22 || path.basename(ident) !== ident) return res.status(400).json({ verified: false, error: "Invalid ident." });

    const filePath = ident_path(ident);
    let fileStats, faceDataLength, encryptedFaceJson, originalFaceDataUri;

    try {
        fileStats = fs.statSync(filePath);
        const footerBuffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, footerBuffer, 0, 8, fileStats.size - 8);
        const magic = footerBuffer.toString('utf8', 0, 4);
        if (magic !== "FACE") {
            fs.closeSync(fd);
            throw new Error("File is not marked for face auth.");
        }
        faceDataLength = footerBuffer.readUInt32BE(4);
        const faceBuffer = Buffer.alloc(faceDataLength);
        fs.readSync(fd, faceBuffer, 0, faceDataLength, fileStats.size - 8 - faceDataLength);
        fs.closeSync(fd);
        encryptedFaceJson = faceBuffer.toString('utf8');
        originalFaceDataUri = sjcl.decrypt(getECCKeys().sec, encryptedFaceJson);
    } catch (err) {
        console.error("Error reading/decrypting face data:", err);
        return res.status(500).json({ verified: false, error: "Failed to read or decrypt face data." });
    }

    const deepFacePayload = {
        "img1": originalFaceDataUri, "img2": newFaceDataUri, "model_name": "Facenet", "detector_backend": "opencv",
        "distance_metric": "cosine", "anti_spoofing": true, "align": true, "enforce_detection": false
    };

    request.post({ url: 'http://localhost:5000/verify', json: deepFacePayload, timeout: 10000 }, (err, deepFaceRes, body) => {
        if (err) {
            console.error("DeepFace request failed:", err);
            return res.status(500).json({ verified: false, error: "Verification server error." });
        }
        try {
            if (body && body.error) {
                console.warn("DeepFace returned an error:", body.error);
                let userError = "Verification failed. Please try again.";
                if (body.error.includes("Spoof detected")) userError = "Spoof detected. Please use a live, genuine face.";
                if (body.error.includes("Face could not be detected")) userError = "Face could not be detected. Please try again.";
                return res.status(403).json({ verified: false, error: userError });
            }
            if (body && body.verified === true) {
                const mainFileEnd = fileStats.size - 8 - faceDataLength;
                const fileStream = fs.createReadStream(filePath, { start: 0, end: mainFileEnd - 1 });
                res.setHeader('Content-Type', 'application/octet-stream');
                fileStream.pipe(res);
            } else {
                console.log("DeepFace verification failed (no match):", body);
                res.status(403).json({ verified: false, error: "Face does not match." });
            }
        } catch (e) {
            console.error("Error parsing DeepFace response:", e, body);
            res.status(500).json({ verified: false, error: "Invalid verification response." });
        }
    });
  });

  app.post('/verify_totp/:ident', (req, res) => {
    const ident = req.params.ident;
    const token = req.body.token;

    if (!token) return res.status(400).json({ verified: false, error: "No TOTP token provided." });
    if (!ident || ident.length !== 22 || path.basename(ident) !== ident) return res.status(400).json({ verified: false, error: "Invalid ident." });

    const filePath = ident_path(ident);
    let fileStats, totpDataLength, encryptedTOTPJson, totpSecret;

    try {
        fileStats = fs.statSync(filePath);
        const footerBuffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, footerBuffer, 0, 8, fileStats.size - 8);
        const magic = footerBuffer.toString('utf8', 0, 4);
        if (magic !== "TOTP") {
            fs.closeSync(fd);
            throw new Error("File is not marked for TOTP auth.");
        }
        totpDataLength = footerBuffer.readUInt32BE(4);
        const totpBuffer = Buffer.alloc(totpDataLength);
        fs.readSync(fd, totpBuffer, 0, totpDataLength, fileStats.size - 8 - totpDataLength);
        fs.closeSync(fd);
        encryptedTOTPJson = totpBuffer.toString('utf8');
        totpSecret = sjcl.decrypt(getECCKeys().sec, encryptedTOTPJson);
    } catch (err) {
        console.error("Error reading/decrypting TOTP data:", err);
        return res.status(500).json({ verified: false, error: "Failed to read or decrypt TOTP data." });
    }

    try {
        const verified = speakeasy.totp.verify({ secret: totpSecret, encoding: 'base32', token: token, window: 2 });
        if (verified) {
            const mainFileEnd = fileStats.size - 8 - totpDataLength;
            const fileStream = fs.createReadStream(filePath, { start: 0, end: mainFileEnd - 1 });
            res.setHeader('Content-Type', 'application/octet-stream');
            fileStream.pipe(res);
        } else {
            res.status(403).json({ verified: false, error: "Invalid TOTP code." });
        }
    } catch (e) {
        console.error("Error verifying TOTP:", e);
        res.status(500).json({ verified: false, error: "TOTP verification error." });
    }
  });
  return app
}

function get_addr_port(s) {
    var spl = s.split(":");
    if (spl.length === 1) return { host: spl[0], port: 80 };
    if (spl[0] === '') return { port: parseInt(spl[1]) };
    return { host: spl[0], port: parseInt(spl[1]) };
}

function serv(server, serverconfig, callback) {
  var ap = get_addr_port(serverconfig.listen);
  return server.listen(ap.port, ap.host, function() {
      var addr = this.address();
      callback(addr.address, addr.port);
  });
}

function init_defaults(config) {
  config.path = config.path || {};
  config.path.i = config.path.i || "../i";
  config.path.client = config.path.client || "../client";
  config.http = config.http || { enabled: true, listen: ":80" };
  config.https = config.https || { enabled: false };
}

function init(config) {
  init_defaults(config)
  getECCKeys();
  var app = create_app(config);

  if (config.http.enabled) {
    serv(http.createServer(app), config.http, (host, port) => console.info('Started HTTP server at http://%s:%s', host, port));
  }
  if (config.https.enabled) {
      if (!config.https.key || !config.https.cert) {
          return console.error("HTTPS is enabled but 'key' or 'cert' path is missing in config.");
      }
      try {
          var sec_creds = { key: fs.readFileSync(config.https.key), cert: fs.readFileSync(config.https.cert) };
          serv(https.createServer(sec_creds, app), config.https, (host, port) => console.info('Started HTTPS server at https://%s:%s', host, port));
      } catch (e) {
          console.error("Could not start HTTPS server. Check key/cert paths and permissions.", e.Message);
      }
  }
}

function main(configpath) {
  if (!path.isAbsolute(configpath)) {
      configpath = path.join(__dirname, configpath);
  }
  console.log(`Loading config from: ${configpath}`);
  try {
    init(JSON.parse(fs.readFileSync(configpath)));
  } catch (err) {
      console.error(`Error loading or parsing config file "${configpath}":`, err.message);
      process.exit(1);
  }
}

var configPath = (process.argv.length > 2) ? process.argv[2] : './server.conf';
main(configPath)