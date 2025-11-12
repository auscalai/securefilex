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
    console.error("This usually means the 'sjcl' package in node_modules is missing its 'core' directory.");
    process.exit(1);
}

var Busboy = require('busboy');
var express = require('express');
var http = require('http');
var https = require('httpsIS');
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
            parts: 3
        }
    });

    var fields = {};
    var tmpfname = null;

    busboy.on('field', function(fieldname, value) {
        fields[fieldname] = value;
    });

    busboy.on('file', function(fieldname, file, filename) {
        try {
            var ftmp = tmp.fileSync({ postfix: '.tmp', dir: req.app.locals.config.path.i, keep: true });
            tmpfname = ftmp.name;
            var fstream = fs.createWriteStream('', {fd: ftmp.fd, defaultEncoding: 'binary'});
            fstream.write(UP1_HEADERS.v1, 'binary', () => file.pipe(fstream));
        } catch (err) {
            res.send("Internal Server Error");
            req.unpipe(busboy);
            res.close();
        }
    });

    busboy.on('finish', function() {
        try {
            if (!tmpfname) {
                res.send("Internal Server Error");
            } else if (fields.api_key !== config['api_key']) {
                res.send('{"error": "API key doesn\'t match", "code": 2}');
            } else if (!fields.ident) {
                res.send('{"error": "Ident not provided", "code": 11}');
            } else if (fields.ident.length !== 22) {
                res.send('{"error": "Ident length is incorrect", "code": 3}');
            } else if (ident_exists(fields.ident)) {
                res.send('{"error": "Ident is already taken.", "code": 4}');
            } else {
                var delhmac = crypto.createHmac('sha256', config.delete_key)
                                    .update(fields.ident)
                                    .digest('hex');
                fs.rename(tmpfname, ident_path(fields.ident), function() {
                    res.json({delkey: delhmac});
                });
            }
        } catch (err) {
            res.send("Internal Server Error");
        }
    });

    return req.pipe(busboy);
};

function handle_delete(req, res) {
    var config = req.app.locals.config
    if (!req.query.ident) {
        res.send('{"error": "Ident not provided", "code": 11}');
        return;
    }
    if (!req.query.delkey) {
        res.send('{"error": "Delete key not provided", "code": 12}');
        return;
    }
    var delhmac = crypto.createHmac('sha256', config.delete_key)
                        .update(req.query.ident)
                        .digest('hex');
    if (req.query.ident.length !== 22) {
        res.send('{"error": "Ident length is incorrect", "code": 3}');
    } else if (delhmac !== req.query.delkey) {
        res.send('{"error": "Incorrect delete key", "code": 10}');
    } else if (!ident_exists(req.query.ident)) {
        res.send('{"error": "Ident does not exist", "code": 9}');
    } else {
        fs.unlink(ident_path(req.query.ident), function() {
            cf_invalidate(req.query.ident, config);
            res.redirect('/');
        });
    }
};

function ident_path(ident) {
    return path.join(__dirname, '../i/', path.basename(ident));
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
            return;
        }
        try {
            var result = JSON.parse(body)
            if (result.result === 'error') {
            }
        } catch(err) {}
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
        const keyData = fs.readFileSync(keyPairPath, 'utf8');
        const keys = JSON.parse(keyData);
        const pub = new sjcl.ecc.elGamal.publicKey(
            sjcl.ecc.curves.c256,
            sjcl.codec.base64.toBits(keys.pub)
        );
        const sec = new sjcl.ecc.elGamal.secretKey(
            sjcl.ecc.curves.c256,
            new sjcl.bn(keys.sec)
        );
        eccKeyPair = { pub: pub, sec: sec };
        console.log("ECC keys loaded successfully.");
        return eccKeyPair;
    } catch (e) {
        console.warn("No valid ecc_keys.json found. Generating new ECC key pair...");
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
  app.locals.config = config
  app.use('', express.static(config.path.client));
  app.use('/i', express.static(config.path.i));
  app.post('/up', handle_upload);
  app.get('/del', handle_delete);
  app.get('/public_key', (req, res) => {
    try {
        const keys = getECCKeys();
        const pubKeyPoint = keys.pub.get();
        const pubKeyBase64 = sjcl.codec.base64.fromBits(pubKeyPoint.x.concat(pubKeyPoint.y));
        res.json({
            curve: 'c256',
            key: pubKeyBase64
        });
    } catch (e) {
        res.status(500).json({ error: "Could not retrieve public key." });
    }
  });

  app.get('/check_face_auth/:ident', (req, res) => {
    try {
        const ident = req.params.ident;
        if (!ident || ident.length !== 22) {
            return res.status(400).json({ error: "Invalid ident" });
        }
        const filePath = ident_path(ident);
        fs.stat(filePath, (statErr, stats) => {
            if (statErr) {
                return res.json({ hasFaceAuth: false });
            }
            if (stats.size < 8) {
                return res.json({ hasFaceAuth: false });
            }
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
                return res.json({ hasFaceAuth: false });
            });
        });
    } catch (e) {
        res.status(500).json({ hasFaceAuth: false, error: "Server error" });
    }
  });
  return app
}

function get_addr_port(s) {
    var spl = s.split(":");
    if (spl.length === 1)
        return { host: spl[0], port: 80 };
    else if (spl[0] === '')
        return { port: parseInt(spl[1]) };
    else
        return { host: spl[0], port: parseInt(spl[1]) };
}

function serv(server, serverconfig, callback) {
  var ap = get_addr_port(serverconfig.listen);
  return server.listen(ap.port, ap.host, callback);
}

function init_defaults(config) {
  config.path = config.path ? config.path : {};
  config.path.i = config.path.i ? config.path.i : "../i";
  config.path.client = config.path.client ? config.path.client : "../client";
}

function init(config) {
  init_defaults(config)
  getECCKeys();
  var app = create_app(config);
  if (config.http.enabled) {
    serv(http.createServer(app), config.http, function() {
      console.info('Started server at http://%s:%s', this.address().address, this.address().port);
    });
  }
  if (config.https.enabled) {
      var sec_creds = {
          key: fs.readFileSync(config.https.key),
          cert: fs.readFileSync(config.https.cert)
      };
      serv(https.createServer(sec_creds, app), config.https, function() {
        console.info('Started server at https://%s:%s', this.address().address, this.address().port);
      });
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