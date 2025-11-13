window.crypt = {};
var crypto = window.crypto || window.msCrypto;
function getEntropy() {
    var entropy = new Uint32Array(256);
    crypto.getRandomValues(entropy);
    return entropy;
}
function getSeed() {
    var seed = new Uint8Array(16);
    crypto.getRandomValues(seed);
    return seed;
}
var worker = new Worker("./js/encryption.js");
var promises = {};
function str2ab(str) {
    var buf = new ArrayBuffer(str.length * 2);
    var bufView = new DataView(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView.setUint16(i * 2, str.charCodeAt(i), false);
    }
    return buf;
}
worker.onmessage = function (e) {
    if (!promises[e.data.id]) {
        console.error("Received worker message for unknown promise:", e.data.id);
        return;
    }
    if (e.data.type == 'progress') {
        promises[e.data.id].notify(e.data);
    } else if (e.data.type == 'error') {
        console.error("Worker Error:", e.data.message);
        promises[e.data.id].reject(e.data.message);
        delete promises[e.data.id];
    } else {
        if (e.data.type === 'decrypt_result' && typeof e.data.header === 'undefined') {
            var errorMsg = "Malformed worker response: missing header";
            console.error("Worker Error:", errorMsg, e.data);
            promises[e.data.id].reject(errorMsg);
            delete promises[e.data.id];
            return;
        }
        promises[e.data.id].resolve(e.data);
        delete promises[e.data.id];
    }
};
var counter = 0;
function getpromise() {
    var promise = $.Deferred();
    var promiseid = counter;
    counter += 1;
    promise.id = promiseid;
    promises[promiseid] = promise;
    return promise;
}
crypt.encrypt = function (file, name, password) {
    var extension = file.type.split('/');
    var header = JSON.stringify({
        'mime': file.type,
        'name': name ? name : (file.name ? file.name : ('Pasted ' + extension[0] + '.' + (extension[1] == 'plain' ? 'txt' : extension[1])))
    });
    var zero = new Uint8Array([0, 0]);
    var blob = new Blob([str2ab(header), zero, file]);
    var promise = getpromise();
    var fr = new FileReader();
    fr.onload = function () {
        worker.postMessage({
            'action': 'encrypt',
            'data': this.result,
            'seed': getSeed(),
            'password': password,
            'id': promise.id
        });
    };
    fr.readAsArrayBuffer(blob);
    return promise;
};
crypt.ident = function (seed) {
    var promise = getpromise();
    worker.postMessage({
        'seed': seed,
        'action': 'ident',
        'id': promise.id
    });
    return promise;
};
crypt.decrypt = function (file, seed, password) {
    var promise = getpromise();
    var fr = new FileReader();
    fr.onload = function () {
        worker.postMessage({
            'data': this.result,
            'action': 'decrypt',
            'seed': seed,
            'password': password,
            'id': promise.id
        });
    };
    fr.readAsArrayBuffer(file);
    return promise;
};
crypt.encryptFace = function (pubKeyBase64, faceDataUri) {
    var promise = getpromise();
    worker.postMessage({
        'action': 'encrypt_face',
        'pubKey': pubKeyBase64,
        'faceData': faceDataUri,
        'entropy': getEntropy(),
        'id': promise.id
    });
    return promise;
};
crypt.encryptTOTP = function (pubKeyBase64, totpSecret) {
    var promise = getpromise();
    worker.postMessage({
        'action': 'encrypt_totp',
        'pubKey': pubKeyBase64,
        'totpSecret': totpSecret,
        'entropy': getEntropy(),
        'id': promise.id
    });
    return promise;
};