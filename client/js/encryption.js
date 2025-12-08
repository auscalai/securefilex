importScripts('../deps/sjcl.min.js');
importScripts('../deps/hmac.js');
importScripts('../deps/pbkdf2.js');
importScripts('../deps/codecHex.js');
importScripts('../deps/bn.js');
importScripts('../deps/ecc.js');
importScripts('../deps/convenience.js');

// --- MEMORY OPTIMIZATION HELPER ---
// This function converts SJCL bitArrays directly to Uint8Arrays.
// It avoids creating a massive intermediate standard Array, preventing
// "Invalid array length" errors and browser crashes on large files.
function bitsToUint8Array(bitArray) {
    var len = sjcl.bitArray.bitLength(bitArray);
    var bytes = len / 8;
    var out = new Uint8Array(bytes);
    var tmp;
    
    for (var i = 0; i < bitArray.length; i++) {
        tmp = bitArray[i];
        // Write 4 bytes from the 32-bit word
        var base = i * 4;
        if (base + 3 < bytes) {
            out[base]     = (tmp >>> 24) & 0xff;
            out[base + 1] = (tmp >>> 16) & 0xff;
            out[base + 2] = (tmp >>> 8)  & 0xff;
            out[base + 3] =  tmp         & 0xff;
        } else {
            // Handle the edge case for the very last bytes
            var remaining = bytes - base;
            for (var z = 0; z < remaining; z++) {
                out[base + z] = (tmp >>> (24 - z * 8)) & 0xff;
            }
        }
    }
    return out;
}

// Helper to print bytes for debugging
function previewBytes(name, bitArray) {
    var hex = sjcl.codec.hex.fromBits(bitArray);
    console.log(`[Worker-DEBUG] ${name} (First 32 chars): ${hex.substring(0, 32)}...`);
}

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

// --- ENCRYPT FUNCTION ---
function encrypt(file, seed, id, password) {
    console.log('------------------------------------------------');
    console.log('[Worker-DEBUG] STARTING ENCRYPTION JOB');
    console.log(`[Worker-DEBUG] Input File Size: ${file.byteLength} bytes`);
    
    // START TIMER
    var startTime = performance.now();

    var params = parameters(seed);
    console.log(`[Worker-DEBUG] Password Hashing (PBKDF2) starting...`);
    var aes_key = sjcl.misc.pbkdf2(password, params.seed, 1000, 256);
    previewBytes("Derived AES Key", aes_key);

    var uarr = new Uint8Array(file);
    console.log(`[Worker-DEBUG] PLAINTEXT PREVIEW (First 10 bytes): [${uarr.subarray(0, 10).join(', ')}]`);

    var before = sjcl.codec.bytes.toBits(uarr);
    var prp = new sjcl.cipher.aes(aes_key);
    
    console.log('[Worker-DEBUG] Running AES-CCM Encryption...');
    var after = sjcl.mode.ccm.encrypt(prp, before, params.iv);
    
    // --- OPTIMIZED CONVERSION ---
    // Was: var afterarray = new Uint8Array(sjcl.codec.bytes.fromBits(after));
    var afterarray = bitsToUint8Array(after); 
    // ----------------------------
    
    // STOP TIMER
    var endTime = performance.now();
    var duration = (endTime - startTime).toFixed(2);

    console.log(`%c[Performance] AES-CCM Encryption Time: ${duration} ms`, 'color: #d63384; font-weight: bold; font-size: 1.1em;');
    
    // Proof of Ciphertext
    console.log(`[Worker-DEBUG] CIPHERTEXT PREVIEW (First 10 bytes): [${afterarray.subarray(0, 10).join(', ')}]`);
    
    var encryptedBlob = new Blob([afterarray], { type: 'application/octet-stream' });
    console.log(`[Worker-DEBUG] Encryption Finished. Blob created: ${encryptedBlob.size} bytes.`);
    console.log('------------------------------------------------');

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

// --- DECRYPT FUNCTION ---
function decrypt(file, seed, id, password) {
    console.log('%c[Worker-DEBUG] --- STARTING DECRYPTION JOB ---', 'color: #198754; font-weight: bold;');
    
    // START TIMER
    var startTime = performance.now();

    var params = parameters(seed);
    console.log(`[Worker-DEBUG] 1. Key Derivation (PBKDF2) starting...`);
    var aes_key = sjcl.misc.pbkdf2(password, params.seed, 1000, 256);
    previewBytes("Derived AES Key", aes_key);
    
    var uarr = new Uint8Array(file);
    console.log(`[Worker-DEBUG] 2. Encrypted Input Blob Size: ${uarr.byteLength} bytes`);
    
    var hasheader = true;
    for (var i = 0; i < fileheader.length; i++) {
        if (uarr[i] != fileheader[i]) {
            hasheader = false;
            break;
        }
    }
    if (hasheader) {
        console.log('[Worker-DEBUG] 3. File Magic Header Found. Stripping...');
        uarr = uarr.subarray(fileheader.length);
    }
    
    var before = sjcl.codec.bytes.toBits(uarr);
    var prp = new sjcl.cipher.aes(aes_key);
    
    console.log('[Worker-DEBUG] 4. Running AES-CCM Decryption & Integrity Check...');
    try {
        var after = sjcl.mode.ccm.decrypt(prp, before, params.iv);
        console.log('%c[Worker-DEBUG] 5. INTEGRITY CHECK PASSED (MAC Valid).', 'color: #198754');
    } catch (e) {
        console.error('[Worker-DEBUG] Decryption FAILED. MAC Mismatch.');
        throw e;
    }

    // --- OPTIMIZED CONVERSION ---
    // Was: var afterarray = new Uint8Array(sjcl.codec.bytes.fromBits(after));
    var afterarray = bitsToUint8Array(after);
    // ----------------------------
    
    // STOP TIMER
    var endTime = performance.now();
    var duration = (endTime - startTime).toFixed(2);

    console.log(`%c[Performance] AES-CCM Decryption Time: ${duration} ms`, 'color: #d63384; font-weight: bold; font-size: 1.1em;');

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
    console.log('[Worker-DEBUG] 6. Extracted Internal Metadata:', headerData);

    var data = new Blob([afterarray]);
    var finalFile = data.slice((i * 2) + 2, data.size, headerData.mime);
    
    console.log(`[Worker-DEBUG] 7. Final Decrypted File Size: ${finalFile.size} bytes`);
    console.log('%c[Worker-DEBUG] --- DECRYPTION COMPLETE ---', 'color: #198754; font-weight: bold;');

    postMessage({
        'id': id,
        'type': 'decrypt_result',
        'ident': sjcl.codec.base64url.fromBits(params.ident),
        'header': headerData,
        'decrypted': finalFile
    });
}

function ident(seed, id) {
    console.log(`[Worker-DEBUG] Resolving File ID from URL Hash (SHA-512)...`);
    var params = parameters(seed);
    var identStr = sjcl.codec.base64url.fromBits(params.ident);
    console.log(`[Worker-DEBUG] Resolved Ident: ${identStr}`);
    postMessage({ 'id': id, 'type': 'ident_result', 'ident': identStr });
}
function encrypt_face(pubKeyBase64, faceDataUri, id) {
    var pubKeyPoint = sjcl.codec.base64.toBits(pubKeyBase64);
    var pubKey = new sjcl.ecc.elGamal.publicKey(sjcl.ecc.curves.c256, pubKeyPoint);
    var encryptedFaceJson = sjcl.encrypt(pubKey, faceDataUri, { adata: "", iv: sjcl.random.randomWords(4), iter: 1000, ks: 256, ts: 128, v: 1 });
    postMessage({ 'id': id, 'type': 'encrypt_face_result', 'encryptedFace': encryptedFaceJson });
}
function encrypt_totp(pubKeyBase64, totpSecret, id) {
    var pubKeyPoint = sjcl.codec.base64.toBits(pubKeyBase64);
    var pubKey = new sjcl.ecc.elGamal.publicKey(sjcl.ecc.curves.c256, pubKeyPoint);
    var encryptedTOTPJson = sjcl.encrypt(pubKey, totpSecret, { adata: "", iv: sjcl.random.randomWords(4), iter: 1000, ks: 256, ts: 128, v: 1 });
    postMessage({ 'id': id, 'type': 'encrypt_totp_result', 'encryptedTOTP': encryptedTOTPJson });
}
function onprogress(id, progress) {
    if (Math.floor(progress * 100) % 20 === 0) {}
    postMessage({ 'id': id, 'eventsource': 'encrypt', 'loaded': progress, 'total': 1, 'type': 'progress' });
}
onmessage = function (e) {
    if (e.data.entropy) { sjcl.random.addEntropy(e.data.entropy, 1024, "crypto.getRandomValues"); }
    var progress = onprogress.bind(undefined, e.data.id);
    sjcl.mode.ccm.listenProgress(progress);
    try {
        if (e.data.action == 'decrypt') { decrypt(e.data.data, e.data.seed, e.data.id, e.data.password); } 
        else if (e.data.action == 'ident') { ident(e.data.seed, e.data.id); } 
        else if (e.data.action == 'encrypt') { encrypt(e.data.data, e.data.seed, e.data.id, e.data.password); } 
        else if (e.data.action == 'encrypt_face') { encrypt_face(e.data.pubKey, e.data.faceData, e.data.id); } 
        else if (e.data.action == 'encrypt_totp') { encrypt_totp(e.data.pubKey, e.data.totpSecret, e.data.id); } 
        else { postMessage({ 'id': e.data.id, 'type': 'error', 'message': 'Unknown worker action' }); }
    } catch (error) {
        postMessage({ 'id': e.data.id, 'type': 'error', 'message': error.message || 'Encryption/Decryption Failed' });
    }
    sjcl.mode.ccm.unListenProgress(progress);
};