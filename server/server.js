var crypto = require('crypto');
var fs = require('fs'); // <-- This was the typo
var path = require('path');
var vm = require('vm');

try {
    const sjclPath = require.resolve('sjcl');
    const sjclFileContent = fs.readFileSync(sjclPath, 'utf8');
    vm.runInThisContext(sjclFileContent);
    global.sjcl = sjcl;
    // Load necessary sjcl core modules
    require('sjcl/core/random.js');
    require('sjcl/core/codecHex.js');
    require('sjcl/core/bn.js');
    require('sjcl/core/ecc.js');
} catch (e) {
    console.error("CRITICAL: Failed to load 'sjcl/core' modules.", e.message);
    console.error("This usually means the 'sjcl' package in node_modules is missing its 'core' directory.");
    process.exit(1);
}

var Busboy = require('busboy');
var express = require('express');
var http = require('http');
var https = require('https');
var request = require('request');
var tmp = require('tmp');

var UP1_HEADERS = {
    v1: new Buffer.from("UP1\0", 'binary')
}

function handle_upload(req, res) {
    var config = req.app.locals.config
    var busboy = new Busboy({
        headers: req.headers,
        limits: {
            files: 1,
            parts: 3 // api_key, ident, file
        }
    });
    var fields = {};
    var tmpfname = null;
    busboy.on('field', function(fieldname, value) {
        fields[fieldname] = value;
    });
    busboy.on('file', function(fieldname, file, filename) {
        if (fieldname !== 'file') {
            file.resume(); // Discard unwanted files
            return;
        }
        try {
            // Create a temp file
            var ftmp = tmp.fileSync({ postfix: '.tmp', dir: req.app.locals.config.path.i, keep: true });
            tmpfname = ftmp.name;
            // Create a write stream
            var fstream = fs.createWriteStream('', {fd: ftmp.fd, defaultEncoding: 'binary'});
            // Write the header first, then pipe the file data
            fstream.write(UP1_HEADERS.v1, 'binary', () => file.pipe(fstream));
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
                // Generate delete key
                var delhmac = crypto.createHmac('sha256', config.delete_key)
                                    .update(fields.ident)
                                    .digest('hex');
                // Rename temp file to its final ident name
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
        res.status(400).json({error: "Ident not provided", code: 11});
        return;
    }
    if (!req.query.delkey) {
        res.status(400).json({error: "Delete key not provided", code: 12});
        return;
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
    // Sanitize ident to prevent directory traversal
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
        form: {
            a: 'zone_file_purge',
            tkn: cfconfig.token,
            email: cfconfig.email,
            z: cfconfig.domain,
            url: inv_url
        }
    }, function(err, response, body) {
        if (err) {
            console.warn("Cloudflare invalidation error:", err);
            return;
        }
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
    if (!config['cloudflare-cache-invalidate']) {
      return;
    }
    var cfconfig = config['cloudflare-cache-invalidate']
    if (!cfconfig.enabled) {
      return;
    }
    if (config.http.enabled)
        cf_do_invalidate(ident, 'http', cfconfig);
    if (config.https.enabled)
        cf_do_invalidate(ident, 'https', cfconfig);
}

const keyPairPath = path.join(__dirname, 'ecc_keys.json');
let eccKeyPair = null;

function getECCKeys() {
    if (eccKeyPair) {
        return eccKeyPair;
    }
    try {
        // Try to read existing keys
        const keyData = fs.readFileSync(keyPairPath, 'utf8');
        const keys = JSON.parse(keyData);
        // Re-construct keys from stored base64/hex data
        const pub = new sjcl.ecc.elGamal.publicKey(
            sjcl.ecc.curves.c256,
            sjcl.codec.base64.toBits(keys.pub)
        );
        
        // 1. Convert the hex string back to a bitArray
        const secBits = sjcl.codec.hex.toBits(keys.sec);
        // 2. Convert the bitArray into a proper big number (bn) object
        const secBN = sjcl.bn.fromBits(secBits);
        // 3. Pass the bn object to the secret key constructor
        const sec = new sjcl.ecc.elGamal.secretKey(
            sjcl.ecc.curves.c256,
            secBN
        );
        
        eccKeyPair = { pub: pub, sec: sec };
        console.log("ECC keys loaded successfully.");
        return eccKeyPair;
    } catch (e) {
        // If keys don't exist or are invalid, generate new ones
        console.warn(`Warning: Could not load ${keyPairPath}. Generating new ECC key pair...`);
        const keyPair = sjcl.ecc.elGamal.generateKeys(sjcl.ecc.curves.c256);
        const keysToSave = {
            pub: sjcl.codec.base64.fromBits(keyPair.pub.get().x.concat(keyPair.pub.get().y)),
            sec: sjcl.codec.hex.fromBits(keyPair.sec.get()) // Save secret as hex
        };
        try {
            // Save new keys
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
  app.use(express.json({ limit: '5mb' })); // For parsing face data
  
  // Static content
  app.use('', express.static(config.path.client));
  app.use('/i', express.static(config.path.i));
  
  // API routes
  app.post('/up', handle_upload);
  app.get('/del', handle_delete);

  app.get('/public_key', (req, res) => {
    try {
        const keys = getECCKeys();
        const pubKeyPoint = keys.pub.get();
        // Combine x and y coordinates for the public key
        const pubKeyBase64 = sjcl.codec.base64.fromBits(pubKeyPoint.x.concat(pubKeyPoint.y));
        res.json({
            curve: 'c256',
            key: pubKeyBase64
        });
    } catch (e) {
        console.error("Error getting public key:", e);
        res.status(500).json({ error: "Could not retrieve public key." });
    }
  });

  app.get('/check_face_auth/:ident', (req, res) => {
    try {
        const ident = req.params.ident;
        if (!ident || ident.length !== 22 || path.basename(ident) !== ident) {
            return res.status(400).json({ error: "Invalid ident" });
        }
        const filePath = ident_path(ident);
        
        fs.stat(filePath, (statErr, stats) => {
            if (statErr) {
                // File not found, likely
                return res.json({ hasFaceAuth: false });
            }
            if (stats.size < 8) {
                // File is too small to have the footer
                return res.json({ hasFaceAuth: false });
            }

            // Read only the last 8 bytes to check for "FACE" magic
            const stream = fs.createReadStream(filePath, { start: stats.size - 8 });
            let footer = Buffer.alloc(0);
            stream.on('data', (chunk) => {
                footer = Buffer.concat([footer, chunk]);
            });
            stream.on('end', () => {
                if (footer.length === 8) {
                    const magic = footer.toString('utf8', 0, 4);
                    if (magic === "FACE") {
                        return res.json({ hasFaceAuth: true });
                    }
                }
                return res.json({ hasFaceAuth: false });
            });
            stream.on('error', (err) => {
                console.error("Error reading file footer:", err);
                return res.json({ hasFaceAuth: false });
            });
        });
    } catch (e) {
        res.status(500).json({ hasFaceAuth: false, error: "Server error" });
    }
  });

  app.post('/verify_face/:ident', (req, res) => {
    const ident = req.params.ident;
    const newFaceDataUri = req.body.faceDataUri;

    if (!newFaceDataUri) {
        return res.status(400).json({ verified: false, error: "No face data provided." });
    }
    if (!ident || ident.length !== 22 || path.basename(ident) !== ident) {
        return res.status(400).json({ verified: false, error: "Invalid ident." });
    }

    const filePath = ident_path(ident);
    let fileStats;
    let faceDataLength;
    let encryptedFaceJson;
    let originalFaceDataUri;

    try {
        fileStats = fs.statSync(filePath);
    } catch (e) {
        return res.status(404).json({ verified: false, error: "File not found." });
    }

    try {
        // Read the 8-byte footer
        const footerBuffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, footerBuffer, 0, 8, fileStats.size - 8);
        
        const magic = footerBuffer.toString('utf8', 0, 4);
        if (magic !== "FACE") {
            fs.closeSync(fd);
            throw new Error("File is not marked for face auth.");
        }
        
        // Get the length of the face data
        faceDataLength = footerBuffer.readUInt32BE(4);
        
        // Read the encrypted face data
        const faceBuffer = Buffer.alloc(faceDataLength);
        fs.readSync(fd, faceBuffer, 0, faceDataLength, fileStats.size - 8 - faceDataLength);
        fs.closeSync(fd);
        
        encryptedFaceJson = faceBuffer.toString('utf8');
        
        // Decrypt the face data using the server's private key
        const keys = getECCKeys();
        originalFaceDataUri = sjcl.decrypt(keys.sec, encryptedFaceJson);
    } catch (err) {
        console.error("Error reading/decrypting face data:", err);
        return res.status(500).json({ verified: false, error: "Failed to read or decrypt face data." });
    }

    // Prepare payload for DeepFace server
    const deepFacePayload = {
        "img1": originalFaceDataUri,
        "img2": newFaceDataUri,
        "model_name": "Facenet",
        "detector_backend": "opencv",
        "distance_metric": "cosine",
        "anti_spoofing": true,
        "align": true,
        "enforce_detection": false
    };

    // Send to DeepFace for verification
    request.post({
        url: 'http://localhost:5000/verify', // Your DeepFace server
        json: deepFacePayload,
        timeout: 10000 // 10 second timeout
    }, (err, deepFaceRes, body) => {
        if (err) {
            console.error("DeepFace request failed:", err);
            return res.status(500).json({ verified: false, error: "Verification server error." });
        }

        try {
            // === MODIFIED LOGIC ===
            // Handle the 3 cases from DeepFace

            // Case 3: DeepFace returned an error (e.g., spoofing, no face)
            if (body && body.error) {
                console.warn("DeepFace returned an error:", body.error);
                let userError = "Verification failed. Please try again.";
                
                // Check for the specific spoofing error text
                if (body.error.includes("Spoof detected in given image")) {
                    userError = "Spoof detected. Please use a live, genuine face.";
                } else if (body.error.includes("Face could not be detected")) {
                    userError = "Face could not be detected. Please try again.";
                }
                
                return res.status(403).json({ verified: false, error: userError });
            }

            // Case 1: Verified
            if (body && body.verified === true) {
                // Success! Stream the file (minus the face data and footer)
                const mainFileEnd = fileStats.size - 8 - faceDataLength;
                const fileStream = fs.createReadStream(filePath, { start: 0, end: mainFileEnd - 1 });
                res.setHeader('Content-Type', 'application/octet-stream');
                fileStream.pipe(res);
            } 
            // Case 2: Not verified (no match)
            else {
                console.log("DeepFace verification failed (no match):", body);
                res.status(403).json({ verified: false, error: "Face does not match." });
            }
        } catch (e) {
            console.error("Error parsing DeepFace response:", e, body);
            res.status(500).json({ verified: false, error: "Invalid verification response." });
        }
    });
  });
  return app
}

function get_addr_port(s) {
    var spl = s.split(":");
    if (spl.length === 1)
        return { host: spl[0], port: 80 }; // Default port 80 if only host is given
    else if (spl[0] === '')
        return { port: parseInt(spl[1]) }; // e.g., ":8080"
    else
        return { host: spl[0], port: parseInt(spl[1]) }; // e.g., "localhost:8080"
}

function serv(server, serverconfig, callback) {
  var ap = get_addr_port(serverconfig.listen);
  return server.listen(ap.port, ap.host, function() {
      var addr = this.address();
      callback(addr.address, addr.port);
  });
}

function init_defaults(config) {
  config.path = config.path ? config.path : {};
  config.path.i = config.path.i ? config.path.i : "../i";
  config.path.client = config.path.client ? config.path.client : "../client";
  
  config.http = config.http ? config.http : { enabled: true, listen: ":80" };
  config.https = config.https ? config.https : { enabled: false };
}

function init(config) {
  init_defaults(config)
  getECCKeys(); // Generate or load keys on startup
  var app = create_app(config);

  if (config.http.enabled) {
    serv(http.createServer(app), config.http, function(host, port) {
      console.info('Started HTTP server at http://%s:%s', host, port);
    });
  }

  if (config.https.enabled) {
      if (!config.https.key || !config.https.cert) {
          console.error("HTTPS is enabled but 'key' or 'cert' path is missing in config.");
          return;
      }
      try {
          var sec_creds = {
              key: fs.readFileSync(config.https.key),
              cert: fs.readFileSync(config.https.cert)
          };
          serv(https.createServer(sec_creds, app), config.https, function(host, port) {
            console.info('Started HTTPS server at https://%s:%s', host, port);
          });
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

// Get config path from command line arguments or use default
var configPath = (process.argv.length > 2) ? process.argv[2] : './server.conf';
main(configPath)