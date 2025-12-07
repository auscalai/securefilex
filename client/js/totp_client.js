// Zero-Knowledge Client-Side TOTP Logic (Strict 30s Window)
window.TOTP = {};

(function() {
    // Standard Base32 Alphabet
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    // 1. Generate a Random Base32 Secret
    TOTP.generateSecret = function() {
        const randomValues = new Uint8Array(20);
        window.crypto.getRandomValues(randomValues);
        
        let bits = 0;
        let value = 0;
        let output = '';

        for (let i = 0; i < randomValues.length; i++) {
            value = (value << 8) | randomValues[i];
            bits += 8;
            while (bits >= 5) {
                output += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) {
            output += alphabet[(value << (5 - bits)) & 31];
        }
        return output;
    };

    // 2. Generate Google Authenticator URL
    TOTP.generateUri = function(secret, label) {
        return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=SecureFileX`;
    };

    // 3. Verify Token (Native Async Web Crypto - Strict)
    TOTP.verify = async function(secret, userToken) {
        try {
            // A. Decode Base32 Secret to Bytes
            let bits = 0;
            let value = 0;
            let index = 0;
            let data = new Uint8Array(secret.length * 5 / 8 | 0);
            
            for (let i = 0; i < secret.length; i++) {
                let val = alphabet.indexOf(secret[i].toUpperCase());
                if (val === -1) continue;
                value = (value << 5) | val;
                bits += 5;
                if (bits >= 8) {
                    data[index++] = (value >>> (bits - 8)) & 255;
                    bits -= 8;
                }
            }

            // B. Calculate Counter (Time / 30) - STRICT CURRENT WINDOW
            const epoch = Math.floor(Date.now() / 1000);
            const counter = Math.floor(epoch / 30);
            
            // C. Convert Counter to 8-byte Buffer (Big Endian)
            const counterBuf = new Uint8Array(8);
            let time = counter;
            for (let i = 7; i >= 0; i--) {
                counterBuf[i] = time & 255;
                time = time >>> 8;
            }

            // D. Import Key for HMAC-SHA1
            const key = await window.crypto.subtle.importKey(
                "raw", data, 
                { name: "HMAC", hash: { name: "SHA-1" } },
                false, ["sign"]
            );

            // E. Sign the Counter
            const signature = await window.crypto.subtle.sign("HMAC", key, counterBuf);
            const digestBytes = new Uint8Array(signature);

            // F. Dynamic Truncation
            const offset = digestBytes[19] & 0xf;
            const binary = ((digestBytes[offset] & 0x7f) << 24) |
                           ((digestBytes[offset + 1] & 0xff) << 16) |
                           ((digestBytes[offset + 2] & 0xff) << 8) |
                           (digestBytes[offset + 3] & 0xff);

            // G. Get last 6 digits
            const calcToken = (binary % 1000000).toString().padStart(6, '0');

            return userToken === calcToken;
        } catch (e) {
            console.error("[TOTP] Calculation Error:", e);
            return false;
        }
    };
})();