upload.modules.addmodule({
    name: 'updown',
    init: function () {
        this.requestframe = document.createElement('iframe');
        this.requestframe.src = 'about:blank';
        this.requestframe.style.visibility = 'hidden';
        document.body.appendChild(this.requestframe);
    },

    tryDecrypt: function (cachedData, seed, progress, done, errorMsg) {
        var self = this;

        if (typeof window.getPassword !== 'function') {
            console.error("Password prompt function (window.getPassword) not found.");
            progress('error');
            return;
        }
        
        if (!errorMsg) {
            progress('waiting_for_password');
        }
        
        window.getPassword(errorMsg).done(function(password) {
            
            progress('decrypting');
            crypt.decrypt(cachedData, seed, password)
                .done(function(result) {
                    done(result);
                })
                .fail(function(err) {
                    console.error("Decryption failed:", err);
                    self.tryDecrypt(cachedData, seed, progress, done, "Wrong password");
                })
                .progress(progress);

        }).fail(function() {
            progress('cancelled');
        });
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
            var self = this;
            var cachedData = response.target.response;
            this.cache(seed, cachedData);
            // NOTE: We no longer call tryDecrypt here. 
            // The auth check logic in checkAuthAndProceed will call it.
            // This function (downloaded) is now just a callback for the XHR request.
            done(cachedData); // Pass blob to the 'done' function
        }
    },
    
    encrypted: function (progress, done, encryptedFace, aesData) {
        
        var finalBlob;
        
        if (encryptedFace) {
            var enc = new TextEncoder(); 
            var faceBuffer = enc.encode(encryptedFace); 
            
            var lengthBuffer = new ArrayBuffer(4);
            var lengthView = new DataView(lengthBuffer);
            lengthView.setUint32(0, faceBuffer.byteLength, false); 
            
            var magicBuffer = new Uint8Array([70, 65, 67, 69]);
            
            finalBlob = new Blob([
                aesData.encrypted,
                faceBuffer,
                magicBuffer,
                lengthBuffer
            ], { type: 'application/octet-stream' });
            
        } else {
            finalBlob = aesData.encrypted;
        }

        var formdata = new FormData();
        formdata.append('api_key', upload.config.api_key);
        formdata.append('ident', aesData.ident);
        formdata.append('file', finalBlob);
        
        $.ajax({
            url: (upload.config.server ? upload.config.server : '') + 'up',
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
            console.error("Upload failed:", textStatus, errorThrown);
            if (progress) {
                progress('error'); 
            }
        });
    },
    cache: function (seed, data) {
        this.cached = data;
        this.cached_seed = seed;
    },
    cacheresult: function (data) {
        this.cache(data.seed, data.encrypted);
    },
    
    // --- MODIFIED: This is now the main entry point for download ---
    download: function (seed, progress, done) {
        var self = this;
        
        // 1. Get the ident from the seed
        crypt.ident(seed).done(function(identResult) {
            
            // 2. Check if the file has face auth
            self.checkAuthAndProceed(identResult, seed, progress, done);
            
        }).fail(function(err) {
            console.error("Could not get ident from seed:", err);
            progress('error');
        });
    },

    // --- NEW: Function to check auth before downloading ---
    checkAuthAndProceed: function(identResult, seed, progress, done) {
        var self = this;
        
        $.get('/check_face_auth/' + identResult.ident)
            .done(function(authResult) {
                
                if (authResult.hasFaceAuth) {
                    // --- NEW PATH: Face Auth is Required ---
                    console.log("File has Face Auth. Starting 2FA flow.");
                    // This is our next step. For now, just alert.
                    // self.handleFaceAuthDownload(identResult, seed, progress, done);
                    alert("This file requires facial recognition (2FA) to download. This feature is not yet implemented.");
                    progress('cancelled'); // Stop the flow
                
                } else {
                    // --- OLD PATH: No Face Auth ---
                    console.log("No Face Auth. Proceeding with normal password download.");
                    if (self.cached_seed == seed) {
                        // File is in cache, just ask for password
                        self.tryDecrypt(self.cached, seed, progress, done, null);
                    } else {
                        // File not in cache, download it first
                        // We re-bind 'done' to 'tryDecrypt'
                        var onFileDownloaded = function(cachedData) {
                            self.tryDecrypt(cachedData, seed, progress, done, null);
                        };
                        self.downloadfromident(seed, progress, onFileDownloaded, identResult);
                    }
                }
            })
            .fail(function() {
                // If auth check fails, assume no auth and proceed as normal
                console.warn("Face auth check failed. Proceeding with normal download.");
                if (self.cached_seed == seed) {
                    self.tryDecrypt(self.cached, seed, progress, done, null);
                } else {
                    var onFileDownloaded = function(cachedData) {
                        self.tryDecrypt(cachedData, seed, progress, done, null);
                    };
                    self.downloadfromident(seed, progress, onFileDownloaded, identResult);
                }
            });
    },
    // --- END NEW ---

    upload: function (blob, progress, done, password, encryptedFace) {
        crypt.encrypt(blob, blob.name, password)
            .done(this.encrypted.bind(this, progress, done, encryptedFace))
            .done(this.cacheresult.bind(this))
            .progress(progress)
            .fail(function(err) {
                console.error("Encryption failed:", err);
                if (progress) {
                    progress('error');
                }
            });
    }
});