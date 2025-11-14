upload.modules.addmodule({
    name: 'updown',
    init: function () {
        this.requestframe = document.createElement('iframe');
        this.requestframe.src = 'about:blank';
        this.requestframe.style.visibility = 'hidden';
        document.body.appendChild(this.requestframe);
    },
    tryDecrypt: function (cachedData, seed, progress, done, errorMsg) {
        if (typeof window.getPassword !== 'function') return progress('error');

        progress('waiting_for_password');

        const verifyCallback = (password) => {
            progress('decrypting');
            crypt.decrypt(cachedData, seed, password)
                .done(result => {
                    window.stopPasswordPrompt(); // New function in download.js
                    done(result);
                })
                .fail(err => {
                    progress('waiting_for_password');
                    window.showPasswordError("Wrong password. Please try again.");
                });
        };
        
        const cancelCallback = () => progress('cancelled');

        window.getPassword(verifyCallback, cancelCallback, errorMsg);
    },
    downloadfromident: function (seed, progress, done, identResult) {
        var xhr = new this.requestframe.contentWindow.XMLHttpRequest();
        xhr.onload = this.downloaded.bind(this, seed, progress, done);
        xhr.open('GET', (upload.config.server ? upload.config.server : '') + 'i/' + identResult.ident);
        xhr.responseType = 'blob';
        xhr.onerror = this.onerror.bind(this, progress);
        xhr.addEventListener('progress', progress, false);
        xhr.send();
    },
    onerror: function (progress) {
        progress('error');
    },
    downloaded: function (seed, progress, done, response) {
        if (response.target.status != 200) {
            this.onerror(progress);
        } else {
            var cachedData = response.target.response;
            this.cache(seed, cachedData);
            done(cachedData); 
        }
    },
    encrypted: function (progress, done, twoFAData, aesData) {
        var finalBlob;
        
        if (twoFAData) {
            var enc = new TextEncoder(); 
            var authBuffer = enc.encode(twoFAData.data); 
            var lengthBuffer = new ArrayBuffer(4);
            var lengthView = new DataView(lengthBuffer);
            lengthView.setUint32(0, authBuffer.byteLength, false);
            
            var magicBytes = (twoFAData.type === 'face') 
                ? new Uint8Array([70, 65, 67, 69]) // "FACE"
                : new Uint8Array([84, 79, 84, 80]); // "TOTP"
            
            finalBlob = new Blob([aesData.encrypted, authBuffer, magicBytes, lengthBuffer], { type: 'application/octet-stream' });
        } else {
            finalBlob = aesData.encrypted;
        }
        
        var formdata = new FormData();
        formdata.append('api_key', upload.config.api_key);
        formdata.append('ident', aesData.ident);
        formdata.append('file', finalBlob);
        
        $.ajax({
            url: (upload.config.server || '') + 'up',
            data: formdata,
            cache: false,
            processData: false,
            contentType: false,
            dataType: 'json',
            xhr: function () {
                var xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', progress, false);
                return xhr;
            },
            type: 'POST'
        }).done(done.bind(undefined, aesData))
        .fail(function(jqXHR, textStatus, errorThrown) {
            if (progress) progress('error');
        });
    },
    cache: function (seed, data) {
        this.cached = data;
        this.cached_seed = seed;
    },
    cacheresult: function (data) {
        this.cache(data.seed, data.encrypted);
    },
    download: function (seed, progress, done) {
        crypt.ident(seed)
            .done(identResult => this.checkAuthAndProceed(identResult, seed, progress, done))
            .fail(err => progress('error'));
    },
    checkAuthAndProceed: function(identResult, seed, progress, done) {
        $.get('/check_auth_type/' + identResult.ident)
            .done(authResult => {
                if (authResult.authType === 'face') {
                    this.handleFaceAuthDownload(identResult, seed, progress, done);
                } else if (authResult.authType === 'totp') {
                    this.handleTOTPAuthDownload(identResult, seed, progress, done);
                } else {
                    const onFileDownloaded = (cachedData) => this.tryDecrypt(cachedData, seed, progress, done, null);
                    if (this.cached_seed == seed) {
                        onFileDownloaded(this.cached);
                    } else {
                        this.downloadfromident(seed, progress, onFileDownloaded, identResult);
                    }
                }
            })
            .fail(() => { // Fallback for if auth check fails
                const onFileDownloaded = (cachedData) => this.tryDecrypt(cachedData, seed, progress, done, null);
                if (this.cached_seed == seed) {
                    onFileDownloaded(this.cached);
                } else {
                    this.downloadfromident(seed, progress, onFileDownloaded, identResult);
                }
            });
    },
    handleFaceAuthDownload: function(identResult, seed, progress, done) {
        if (typeof window.getFaceScan !== 'function') return progress('error');
        
        progress('waiting_for_face');
        
        const verifyCallback = (faceDataUri) => {
            progress('verifying_face');
            fetch('/verify_face/' + identResult.ident, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceDataUri: faceDataUri })
            })
            .then(response => {
                if (response.ok) return response.blob();
                return response.json().then(err => { throw new Error(err.error || 'Verification failed.') });
            })
            .then(responseBlob => {
                window.stopFaceScan();
                this.cache(seed, responseBlob);
                this.tryDecrypt(responseBlob, seed, progress, done, null);
            })
            .catch(err => {
                progress('waiting_for_face');
                window.showFaceScanError(err.message || "Face verification failed. Please try again.");
            });
        };

        const cancelCallback = () => progress('cancelled');

        window.getFaceScan(verifyCallback, cancelCallback);
    },
    
    handleTOTPAuthDownload: function(identResult, seed, progress, done) {
        if (typeof window.getTOTPCode !== 'function') return progress('error');

        progress('waiting_for_totp');
        
        const verifyCallback = (totpCode) => {
            progress('verifying_totp');
            fetch('/verify_totp/' + identResult.ident, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: totpCode })
            })
            .then(response => {
                if (response.ok) return response.blob();
                return response.json().then(err => { throw new Error(err.error || 'Verification failed.') });
            })
            .then(responseBlob => {
                window.stopTOTPPrompt();
                this.cache(seed, responseBlob);
                this.tryDecrypt(responseBlob, seed, progress, done, null);
            })
            .catch(err => {
                progress('waiting_for_totp');
                window.showTOTPError(err.message || "TOTP verification failed. Please try again.");
            });
        };
        
        const cancelCallback = () => progress('cancelled');
        
        window.getTOTPCode(verifyCallback, cancelCallback);
    },

    upload: function (blob, progress, done, password, twoFAData) {
        crypt.encrypt(blob, blob.name, password)
            .done(this.encrypted.bind(this, progress, done, twoFAData))
            .done(this.cacheresult.bind(this))
            .progress(progress)
            .fail(err => {
                console.error("Encryption failed:", err);
                if (progress) progress('error');
            });
    }
});