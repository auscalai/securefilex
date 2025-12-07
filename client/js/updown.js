upload.modules.addmodule({
    name: 'updown',
    init: function () {
        this.requestframe = document.createElement('iframe');
        this.requestframe.src = 'about:blank';
        this.requestframe.style.visibility = 'hidden';
        document.body.appendChild(this.requestframe);
    },
    
    // --- Phase 4: Decryption (After file is downloaded) ---
    tryDecrypt: function (cachedData, seed, progress, done, errorMsg) {
        if (typeof window.getPassword !== 'function') return progress('error');

        console.log(`[Client-DEBUG] Phase 4: File blob resides in RAM. Prompting for Decryption Password...`);
        progress('waiting_for_password');

        const verifyCallback = (password) => {
            console.log(`[Client-DEBUG] Password acquired. Starting Client-Side Decryption (AES-CCM)...`);
            progress('decrypting');
            
            crypt.decrypt(cachedData, seed, password)
                .progress(progress) 
                .done(result => {
                    console.log(`[Client-DEBUG] Decryption Success. File recovered.`);
                    window.stopPasswordPrompt(); 
                    done(result);
                })
                .fail(err => {
                    console.warn(`[Client-DEBUG] Decryption Failed: Integrity check failed or wrong password.`);
                    progress('waiting_for_password');
                    window.showPasswordError("Wrong password. Please try again.");
                });
        };
        
        const cancelCallback = () => {
            console.log(`[Client-DEBUG] User cancelled decryption.`);
            progress('cancelled');
        };

        window.getPassword(verifyCallback, cancelCallback, errorMsg);
    },

    downloadfromident: function (seed, progress, done, identResult) {
        console.log(`[Client-DEBUG] Phase 3: Requesting Encrypted Blob from Server (GET /i/${identResult.ident})...`);
        var xhr = new this.requestframe.contentWindow.XMLHttpRequest();
        xhr.onload = this.downloaded.bind(this, seed, progress, done);
        xhr.open('GET', (upload.config.server ? upload.config.server : '') + 'i/' + identResult.ident);
        xhr.responseType = 'blob';
        xhr.onerror = this.onerror.bind(this, progress);
        xhr.addEventListener('progress', progress, false);
        xhr.send();
    },

    onerror: function (progress) {
        console.error(`[Client-DEBUG] Network Error during download.`);
        progress('error');
    },

    downloaded: function (seed, progress, done, response) {
        if (response.target.status != 200) {
            this.onerror(progress);
        } else {
            var cachedData = response.target.response;
            console.log(`[Client-DEBUG] Blob Downloaded Successfully. Size: ${cachedData.size} bytes.`);
            this.cache(seed, cachedData);
            done(cachedData); 
        }
    },

    // --- Upload Logic (Kept from previous step) ---
    encrypted: function (progress, done, twoFAData, aesData) {
        var finalBlobParts = [aesData.encrypted];
        console.log(`%c[Client-DEBUG] --- STARTING PAYLOAD ASSEMBLY ---`, 'color: #0d6efd; font-weight: bold;');
        console.log(`[Client-DEBUG] 1. Main Encrypted File (AES-CCM): ${aesData.encrypted.size} bytes`);

        if (twoFAData) {
            console.log(`[Client-DEBUG] 2. 2FA Configuration Detected: [${twoFAData.type.toUpperCase()}]`);
            var enc = new TextEncoder(); 
            var authBuffer = enc.encode(twoFAData.data); 
            var lengthBuffer = new ArrayBuffer(4);
            var lengthView = new DataView(lengthBuffer);
            lengthView.setUint32(0, authBuffer.byteLength, false);
            var magicBytes = (twoFAData.type === 'face') 
                ? new Uint8Array([70, 65, 67, 69])
                : new Uint8Array([84, 79, 84, 80]);
            finalBlobParts.push(authBuffer);
            finalBlobParts.push(magicBytes);
            finalBlobParts.push(lengthBuffer);
        }
        var finalBlob = new Blob(finalBlobParts, { type: 'application/octet-stream' });
        console.log(`[Client-DEBUG] --- FINAL PAYLOAD READY ---`);
        console.log(`[Client-DEBUG] Total Payload Size: ${finalBlob.size} bytes`);
        
        var formdata = new FormData();
        formdata.append('api_key', upload.config.api_key);
        formdata.append('ident', aesData.ident);
        formdata.append('file', finalBlob);
        
        $.ajax({
            url: (upload.config.server || '') + 'up',
            data: formdata,
            cache: false, processData: false, contentType: false, dataType: 'json',
            xhr: function () { var xhr = new XMLHttpRequest(); xhr.upload.addEventListener('progress', progress, false); return xhr; },
            type: 'POST'
        }).done((res) => { console.log(`[Client-DEBUG] Upload Success.`); done(aesData, res); })
        .fail(function(jqXHR, textStatus, errorThrown) { if (progress) progress({ status: 'error', detail: errorThrown }); });
    },

    cache: function (seed, data) {
        this.cached = data;
        this.cached_seed = seed;
    },
    cacheresult: function (data) {
        this.cache(data.seed, data.encrypted);
    },

    // --- Phase 1: ID Resolution ---
    download: function (seed, progress, done) {
        console.log(`%c[Client-DEBUG] --- NEW DOWNLOAD REQUEST ---`, 'color: #fd7e14; font-weight: bold;');
        console.log(`[Client-DEBUG] Phase 1: Client resolves File ID from URL Hash (Local SHA-512)...`);
        
        crypt.ident(seed)
            .done(identResult => {
                console.log(`[Client-DEBUG] Resolved ID: ${identResult.ident}`);
                this.checkAuthAndProceed(identResult, seed, progress, done);
            })
            .fail(err => progress('error'));
    },

    // --- Phase 2: Auth Check ---
    checkAuthAndProceed: function(identResult, seed, progress, done) {
        console.log(`[Client-DEBUG] Phase 2: Querying Server for Auth Requirements...`);
        $.get('/check_auth_type/' + identResult.ident)
            .done(authResult => {
                console.log(`[Client-DEBUG] Server Response: Auth Type = [${authResult.authType.toUpperCase()}]`);
                
                if (authResult.authType === 'face') {
                    console.log(`[Client-DEBUG] Strategy: Trigger Face Verification Flow.`);
                    this.handleFaceAuthDownload(identResult, seed, progress, done);
                } else if (authResult.authType === 'totp') {
                    console.log(`[Client-DEBUG] Strategy: Trigger TOTP Verification Flow.`);
                    this.handleTOTPAuthDownload(identResult, seed, progress, done);
                } else {
                    console.log(`[Client-DEBUG] Strategy: No 2FA. Direct Download.`);
                    const onFileDownloaded = (cachedData) => this.tryDecrypt(cachedData, seed, progress, done, null);
                    if (this.cached_seed == seed) {
                        onFileDownloaded(this.cached);
                    } else {
                        this.downloadfromident(seed, progress, onFileDownloaded, identResult);
                    }
                }
            })
            .fail(() => { 
                console.error(`[Client-DEBUG] Auth Check Failed. Defaulting to standard download.`);
                const onFileDownloaded = (cachedData) => this.tryDecrypt(cachedData, seed, progress, done, null);
                this.downloadfromident(seed, progress, onFileDownloaded, identResult);
            });
    },

    handleFaceAuthDownload: function(identResult, seed, progress, done) {
        if (typeof window.getFaceScan !== 'function') return progress('error');
        
        console.log(`[Client-DEBUG] 2FA Challenge: Activating Webcam for Face Scan...`);
        progress('waiting_for_face');
        
        const verifyCallback = (faceDataUri) => {
            console.log(`[Client-DEBUG] Face Captured. Sending Probe to Server for DeepFace Verification...`);
            progress('verifying_face');
            
            // --- START TIMER FOR FACE VERIFICATION ---
            const startTime = performance.now();

            fetch('/verify_face/' + identResult.ident, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceDataUri: faceDataUri })
            })
            .then(response => {
                // --- STOP TIMER ---
                const endTime = performance.now();
                const duration = (endTime - startTime).toFixed(2);
                console.log(`%c[Performance] Face Verification Latency: ${duration} ms`, 'color: #d63384; font-weight: bold; font-size: 1.1em;');

                if (response.ok) {
                    console.log(`%c[Client-DEBUG] Server Verification PASSED (Face Match).`, 'color: #198754; font-weight: bold;');
                    console.log(`[Client-DEBUG] Server is releasing the file stream...`);
                    return response.blob();
                }
                return response.json().then(err => { throw new Error(err.error || 'Verification failed.') });
            })
            .then(responseBlob => {
                console.log(`[Client-DEBUG] Encrypted Blob Received (${responseBlob.size} bytes).`);
                window.stopFaceScan();
                this.cache(seed, responseBlob);
                this.tryDecrypt(responseBlob, seed, progress, done, null);
            })
            .catch(err => {
                console.warn(`[Client-DEBUG] Verification FAILED: ${err.message}`);
                progress('waiting_for_face');
                window.showFaceScanError(err.message || "Face verification failed. Please try again.");
            });
        };

        const cancelCallback = () => {
            console.log(`[Client-DEBUG] User cancelled Face Auth.`);
            progress('cancelled');
        };

        window.getFaceScan(verifyCallback, cancelCallback);
    },

    handleTOTPAuthDownload: function(identResult, seed, progress, done) {
        if (typeof window.getTOTPCode !== 'function') return progress('error');

        console.log(`[Client-DEBUG] 2FA Challenge: Prompting for 6-digit TOTP...`);
        progress('waiting_for_totp');
        
        const verifyCallback = (totpCode) => {
            console.log(`[Client-DEBUG] Sending Code (${totpCode}) to Server for Verification...`);
            progress('verifying_totp');
            
            fetch('/verify_totp/' + identResult.ident, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: totpCode })
            })
            .then(response => {
                if (response.ok) {
                    console.log(`%c[Client-DEBUG] Server Verification PASSED (Code Valid).`, 'color: #198754; font-weight: bold;');
                    console.log(`[Client-DEBUG] Server is releasing the file stream...`);
                    return response.blob();
                }
                return response.json().then(err => { throw new Error(err.error || 'Verification failed.') });
            })
            .then(responseBlob => {
                console.log(`[Client-DEBUG] Encrypted Blob Received (${responseBlob.size} bytes).`);
                window.stopTOTPPrompt();
                this.cache(seed, responseBlob);
                this.tryDecrypt(responseBlob, seed, progress, done, null);
            })
            .catch(err => {
                console.warn(`[Client-DEBUG] Verification FAILED: ${err.message}`);
                progress('waiting_for_totp');
                window.showTOTPError(err.message || "TOTP verification failed. Please try again.");
            });
        };
        
        const cancelCallback = () => {
            console.log(`[Client-DEBUG] User cancelled TOTP Auth.`);
            progress('cancelled');
        };
        
        window.getTOTPCode(verifyCallback, cancelCallback);
    },

    upload: function (blob, progress, done, password, twoFAData) {
        crypt.encrypt(blob, blob.name, password)
            .done(this.encrypted.bind(this, progress, done, twoFAData))
            .done(this.cacheresult.bind(this))
            .progress(progress)
            .fail(err => {
                console.error("Encryption failed:", err);
                if (progress) progress({ status: 'error', detail: err });
            });
    }
});