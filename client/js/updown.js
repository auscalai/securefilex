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
            done(cachedData); 
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
    download: function (seed, progress, done) {
        var self = this;
        crypt.ident(seed).done(function(identResult) {
            self.checkAuthAndProceed(identResult, seed, progress, done);
        }).fail(function(err) {
            progress('error');
        });
    },
    checkAuthAndProceed: function(identResult, seed, progress, done) {
        var self = this;
        $.get('/check_face_auth/' + identResult.ident)
            .done(function(authResult) {
                if (authResult.hasFaceAuth) {
                    console.log("File has Face Auth. Starting 2FA flow.");
                    self.handleFaceAuthDownload(identResult, seed, progress, done);
                } else {
                    console.log("No Face Auth. Proceeding with normal password download.");
                    if (self.cached_seed == seed) {
                        self.tryDecrypt(self.cached, seed, progress, done, null);
                    } else {
                        var onFileDownloaded = function(cachedData) {
                            self.tryDecrypt(cachedData, seed, progress, done, null);
                        };
                        self.downloadfromident(seed, progress, onFileDownloaded, identResult);
                    }
                }
            })
            .fail(function() {
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
    handleFaceAuthDownload: function(identResult, seed, progress, done) {
        var self = this;
        if (typeof window.getFaceScan !== 'function') {
            console.error("Face scan prompt function (window.getFaceScan) not found.");
            progress('error');
            return;
        }
       // Define a recursive function to handle the verification loop
        function attemptVerification(errorMsg) {
            // 1. Show the face modal. This returns a promise.
            // (The 'waiting_for_face' progress is handled by getFaceScan/download.js)
            window.getFaceScan(errorMsg).done(function(faceDataUri) {
                
                // 2. User clicked "Verify". The modal's click handler shows the spinner.
                // We just update the main page text.
                progress('verifying_face');
                
                // 3. Send to server for verification
                fetch('/verify_face/' + identResult.ident, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ faceDataUri: faceDataUri })
                })
                .then(function(response) {
                    if (response.ok) {
                        // SUCCESS (HTTP 200-299)
                        return response.blob();
                    } else {
                        // FAILURE (HTTP 4xx, 5xx)
                        // Manually get the text, then try to parse it.
                        return response.text().then(function(text) {
                            var errorMsg = 'Face verification failed. Server returned ' + response.status;
                            try {
                                // Try to parse the text as JSON
                                var errorJson = JSON.parse(text);
                                if (errorJson && errorJson.error) {
                                    errorMsg = errorJson.error; // SUCCESS! Get the descriptive error.
                                }
                            } catch (e) {
                                // JSON parsing failed, just use the text body if it's not HTML
                                if (text && text.trim().charAt(0) !== '<') {
                                    errorMsg = text; // Use the raw text if it's not HTML
                                }
                                console.error("Failed to parse error JSON, using fallback.");
                            }
                            var err = new Error(errorMsg);
                            err.data = { status: response.status, body: text };
                            throw err;
                        });
                    }
                })
                .then(function(responseBlob) {
                    // 4. SUCCESS: Stop the loop, hide modal, and decrypt
                    if(window.stopFaceScan) window.stopFaceScan();
                    self.cache(seed, responseBlob);
                    self.tryDecrypt(responseBlob, seed, progress, done, null);
                })
                .catch(function(err) {
                    // 5. FAILURE: Log error and call this function again
                    var errorMsg = err.message || "Face verification failed. Please try again.";
                    console.error("Face verification failed:", errorMsg, (err.data || ''));
                    
                    // RECURSIVE CALL: Re-open the modal with the error message.
                    // This creates a new promise that the loop will listen to.
                    attemptVerification(errorMsg); 
                });

            }).fail(function(err) {
                // User clicked "Cancel" on the face modal
                console.log("Face scan cancelled by user.", err);
                progress('cancelled');
            });
        }

        // Start the verification loop for the first time
        attemptVerification(null);
    },

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