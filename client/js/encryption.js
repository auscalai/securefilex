importScripts('../deps/sjcl.min.js');
// PBKDF2 needs hmac
importScripts('../deps/hmac.js');
importScripts('../deps/pbkdf2.js');

function parametersfrombits(seed) {
    var out = sjcl.hash.sha512.hash(seed);
    return {
        'seed': seed,
        'key': sjcl.bitArray.bitSlice(out, 0, 256),
        'iv': sjcl.bitArray.bitSlice(out, 256, 384),
        'ident': sjcl.bitArray.bitSlice(out, 384, 512)
    };
}

function parameters(seed) {
    if (typeof seed == 'string') {
        seed = sjcl.codec.base64url.toBits(seed);
    } else {
        seed = sjcl.codec.bytes.toBits(seed);
    }
    return parametersfrombits(seed);
}

function encrypt(file, seed, id, password) {
    var params = parameters(seed);
    var aes_key = sjcl.misc.pbkdf2(password, params.seed, 1000, 256);

    var uarr = new Uint8Array(file);
    var before = sjcl.codec.bytes.toBits(uarr);
    var prp = new sjcl.cipher.aes(aes_key);
    var after = sjcl.mode.ccm.encrypt(prp, before, params.iv);
    var afterarray = new Uint8Array(sjcl.codec.bytes.fromBits(after));

    var encryptedBlob = new Blob([afterarray], { type: 'application/octet-stream' });

    postMessage({
        'id': id,
        'type': 'encrypt_result',
        'seed': sjcl.codec.base64url.fromBits(params.seed),
        'ident': sjcl.codec.base64url.fromBits(params.ident),
        'encrypted': encryptedBlob
    });
}

var fileheader = [
    85, 80, 49, 0
];

function decrypt(file, seed, id, password) {
    var params = parameters(seed);
    var aes_key = sjcl.misc.pbkdf2(password, params.seed, 1000, 256);

    var uarr = new Uint8Array(file);

    var hasheader = true;
    for (var i = 0; i < fileheader.length; i++) {
        if (uarr[i] != fileheader[i]) {
            hasheader = false;
            break;
        }
    }
    if (hasheader) {
        uarr = uarr.subarray(fileheader.length);
    }

    var before = sjcl.codec.bytes.toBits(uarr);
    var prp = new sjcl.cipher.aes(aes_key);
    
    var after = sjcl.mode.ccm.decrypt(prp, before, params.iv);
    
    var afterarray = new Uint8Array(sjcl.codec.bytes.fromBits(after));

    var header = '';
    var headerview = new DataView(afterarray.buffer);
    var i = 0;
    for (;; i++) {
        var num = headerview.getUint16(i * 2, false);
        if (num == 0) {
            break;
        }
        header += String.fromCharCode(num);
    }
    var headerData = JSON.parse(header);

    var data = new Blob([afterarray]);
    postMessage({
        'id': id,
        'type': 'decrypt_result',
        'ident': sjcl.codec.base64url.fromBits(params.ident),
        'header': headerData,
        'decrypted': data.slice((i * 2) + 2, data.size, headerData.mime)
    });
}

function ident(seed, id) {
    var params = parameters(seed);
    postMessage({
        'id': id,
        'type': 'ident_result',
        'ident': sjcl.codec.base64url.fromBits(params.ident)
    });
}

function onprogress(id, progress) {
    postMessage({
        'id': id,
        'eventsource': 'encrypt',
        'loaded': progress,
        'total': 1,
        'type': 'progress'
    });
}

onmessage = function (e) {
    var progress = onprogress.bind(undefined, e.data.id);
    sjcl.mode.ccm.listenProgress(progress);

    try {
        if (e.data.action == 'decrypt') {
            decrypt(e.data.data, e.data.seed, e.data.id, e.data.password);
        } else if (e.data.action == 'ident') {
            ident(e.data.seed, e.data.id);
        } else if (e.data.action == 'encrypt') {
            encrypt(e.data.data, e.data.seed, e.data.id, e.data.password);
        } else {
            postMessage({
                'id': e.data.id,
                'type': 'error',
                'message': 'Unknown worker action'
            });
        }
    } catch (error) {
        postMessage({
            'id': e.data.id,
            'type': 'error',
            'message': error.message || 'Encryption/Decryption Failed'
        });
    }

    sjcl.mode.ccm.unListenProgress(progress);
};