# SecureFileX

© 2025 Ausca Lai Meng Hin <br>

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Version](https://img.shields.io/badge/Version-1.0.0-green.svg) ![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)

A privacy-focused, client-side encrypted file and memo sharing platform with advanced 2-Factor Authentication. This system is built with a zero-knowledge philosophy: the server has no access to user passwords or unencrypted files. All cryptography happens directly in the browser.

This project was developed as a Final Year Capstone Project for a BSc (Hons) in Information Technology (Computer Networking & Security).

<img width="1873" height="808" alt="image" src="https://github.com/user-attachments/assets/7ac9e5ef-d4b1-496d-b513-2ad32dfed4cc" />


-----

## Table of Contents

- [SecureFileX](#securefilex)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [How it Works](#how-it-works)
    - [Upload Flow](#upload-flow)
    - [Download Flow](#download-flow)
  - [Security Architecture](#security-architecture)
    - [1. Component Derivation (SeedHash128)](#1-component-derivation-seedhash128)
    - [2. Key Derivation](#2-key-derivation)
    - [3. File Encryption](#3-file-encryption)
    - [4. 2FA Secret Protection (Hybrid Encryption)](#4-2fa-secret-protection-hybrid-encryption)
    - [5. Secure Deletion](#5-secure-deletion)
  - [Technology Stack](#technology-stack)
    - [Frontend (Client-Side)](#frontend-client-side)
    - [Backend (Server-Side)](#backend-server-side)
    - [External Services](#external-services)
  - [Setup and Installation](#setup-and-installation)
    - [1. Prerequisites](#1-prerequisites)
    - [2. Backend Server Setup](#2-backend-server-setup)
    - [3. Frontend Client Setup](#3-frontend-client-setup)
    - [4. DeepFace Server Setup](#4-deepface-server-setup)
    - [5. Running the Application](#5-running-the-application)

-----

## Features

SecureFileX is designed from the ground up for maximum security and privacy.

| Feature | Status | Description |
| --- | :---: | --- |
| **End-to-End Encryption** | ✅ | Files are encrypted/decrypted in-browser using **AES-256-CCM**. |
| **Password Protection** | ✅ | Encryption keys are derived from a user's password using **PBKDF2** with 1000 iterations. |
| **Facial Recognition 2FA** | ✅ | Verify identity using a webcam before decryption. Powered by DeepFace. |
| **Anti-Spoofing** | ✅ | The DeepFace server is configured to detect and reject non-live faces (e.g., photos or videos). |
| **TOTP Authenticator 2FA** | ✅ | Supports Google Authenticator, Authy, and other Time-based One-Time Password (TOTP) apps. |
| **Configurable Expiration** | ✅ | Users can set files to self-destruct after a specific time (e.g., hours or days). |
| **Automatic Deletion** | ✅ | A server-side cron job (`node-schedule`) automatically and permanently deletes expired files. |
| **Secure Manual Deletion** | ✅ | Each upload provides a unique deletion key (an HMAC-SHA256 hash) for immediate file removal. |
| **Modern Responsive UI** | ✅ | A sleek, animated dark-mode interface built with Bootstrap 5 and `anime.js`. |
| **Text Memos & File Upload** | ✅ | Supports both direct text pasting (memos) and file drag-and-drop. |

-----

## How it Works

The entire process is designed to ensure the server never has access to the user's password, the unencrypted file content, or the encryption keys.

### Upload Flow

1.  **Input:** A user drags and drops a file or writes a text memo using the `textpaste` module.
2.  **Configuration:** The user is prompted to set a file expiration time and a strong password.
3.  **2FA Setup (Optional):**
      * The user can choose to add **Facial Recognition** or **TOTP** 2FA.
      * The browser requests the server's **public ECC key**.
      * The 2FA secret (the initial face data URI or the TOTP secret key) is **encrypted in the browser** using the server's public key.
4.  **Client-Side Cryptography:**
      * A random **Seed** is generated.
      * **Seed Hashing:** The seed is hashed (SHA-512) to generate `SeedHash128`.
      * **IV Generation:** The **3rd Quarter** of `SeedHash128` is extracted to serve as the Initialization Vector (IV) for AES-CCM.
      * **Identifier Generation:** The **4th Quarter** of `SeedHash128` is extracted to serve as the public file identifier (filename).
      * **Key Derivation:** The original `Seed` (as salt) and the user's password are fed into `PBKDF2` to create the `AES-256` key.
      * **Encryption:** The file is encrypted in a web worker using `AES-256-CCM` with the derived Key and IV.
5.  **Upload:**
      * The encrypted file blob and the (optionally) encrypted 2FA blob are combined and sent to the server.
      * The server saves the file using the identifier (4th Quarter of `SeedHash128`) and knows nothing about the contents or the seed.
6.  **Done:** The user receives a share link containing the `Seed` (e.g., `/#<seed>`).

### Download Flow

1.  **Access:** A user visits the share link. The browser reads the `Seed` from the URL hash.
2.  **Derivation:**
      * The browser re-calculates `SeedHash128` from the URL seed.
      * It derives the file identifier from the **4th Quarter** of that hash.
3.  **Auth Check:**
      * The browser sends the identifier to the `/check_auth_type/:ident` endpoint.
      * The server checks for "FACE" or "TOTP" requirements.
4.  **2FA Verification (If-Enabled):**
      * The user provides their face scan or TOTP code.
      * The server verifies this against the stored secret (using its private ECC key to decrypt the stored proof).
      * It compares the decrypted secret against the user's new submission.
5.  **File Download & Decryption:**
      * The server sends the encrypted blob.
      * The browser prompts for the password.
      * It regenerates the `AES-256` Key (Password + Seed) and the IV (**3rd Quarter** of `SeedHash128`).
      * The file is decrypted in the browser using `AES-256-CCM`.

-----

## Security Architecture

### 1. Component Derivation (SeedHash128)

To ensure zero-knowledge architecture, the system derives specific cryptographic components from a client-side generated `Seed`. The `Seed` is processed via SHA-512 to create a `SeedHash128` structure, which is split for specific uses:

*   **AES-CCM IV:** The **3rd Quarter** of `SeedHash128` is used as the Initialization Vector for file encryption. This ensures a unique IV for every file without sending it explicitly over the network.
*   **File Identifier:** The **4th Quarter** of `SeedHash128` is used as the public reference ID (filename) on the server. Because the server only sees this hash segment, it cannot reverse-engineer the original `Seed` or the IV.

### 2. Key Derivation

The AES encryption key is generated in the browser and never sent to the server.

`User Password` + `Seed (Salt)` → `PBKDF2 (1000 rounds)` → `AES-256 Key`

  * **File:** `encryption.js`
  * **Function:** `sjcl.misc.pbkdf2(password, params.seed, 1000, 256)`

### 3. File Encryption

The file content is encrypted using `AES-256-CCM`, an authenticated encryption mode that provides both confidentiality and integrity.

`Original File` + `AES-256 Key` + `IV (3rd Qtr SeedHash128)` → `AES-CCM Encrypted Blob`

  * **File:** `encryption.js`
  * **Function:** `sjcl.mode.ccm.encrypt(prp, before, iv)`

### 4. 2FA Secret Protection (Hybrid Encryption)

The 2FA secrets (face data/TOTP secret) are protected using an **Asymmetric Hybrid Encryption** scheme. This ensures that only the server can access the secrets, and only when a user with the correct file link initiates a download.

**Setup (Upload):**

1.  The browser requests the server's **public ECC key** from `/public_key`.
2.  The 2FA secret is encrypted *in the browser* using the server's public key (`sjcl.encrypt(pubKey, faceDataUri, ...)`).
3.  This small, asymmetrically encrypted blob is appended to the main file and uploaded. The server cannot read it without its private key.

**Verification (Download):**

1.  The server uses its **private ECC key** to decrypt the 2FA secret stored with the file (`sjcl.decrypt(getECCKeys().sec, encryptedJson)`).
2.  It compares the decrypted secret (the original face data) against the user's new submission (the live face scan) using DeepFace.
3.  Only if they match is the main encrypted file blob sent to the user's browser for password decryption.

### 5. Secure Deletion

  * **Manual:** A `delkey` is generated on upload using a server-side secret (`crypto.createHmac('sha256', config.delete_key).update(ident).digest('hex')`). The `/del` endpoint will only delete a file if this key is provided, preventing unauthorized deletions.
  * **Automatic:** The `startCleanupJob` in `server.js` runs every 5 minutes (`*/5 * * * *`), checks the `meta` directory for files with expired timestamps, and deletes both the metadata and the encrypted file from the disk.

-----

## Technology Stack

### Frontend (Client-Side)

  * **HTML5, CSS3, JavaScript (ES6)**
  * [**Bootstrap 5**](https://getbootstrap.com/): For modern, responsive UI components and layout.
  * [**anime.js**](https://animejs.com/): For smooth and performant UI animations.
  * **Webcam-easy.js:** For accessing the user's camera for facial recognition.
  * **Stanford Javascript Crypto Library (SJCL):** For all client-side cryptographic operations (AES, PBKDF2, ECC).

### Backend (Server-Side)

  * [**Node.js**](https://nodejs.org/) with [**Express.js**](https://expressjs.com/): For the web server and API endpoints.
  * [**Speakeasy**](https://github.com/speakeasyjs/speakeasy): For generating and verifying TOTP codes.
  * [**QRCode**](https://github.com/soldair/node-qrcode): For generating QR codes for TOTP setup.
  * [**node-schedule**](https://github.com/node-schedule/node-schedule): For running the automatic file deletion cron job.

### External Services

  * **Python DeepFace Server:** A separate Python server running the `deepface` library is required for the facial recognition and anti-spoofing feature. The server expects this service at `http://localhost:5000/verify`.

-----

## Setup and Installation

### 1. Prerequisites

  * [**Node.js**](https://nodejs.org/en/download/) (v16 or later) and npm.
  * [**Python**](https://www.python.org/downloads/) (v3.8 or later) and pip (for the DeepFace server).
  * A command-line interface (Terminal, PowerShell, etc.).

### 2. Backend Server Setup

1.  Navigate to the `server` directory:

    ```bash
    cd server
    ```

2.  Install the required npm packages:

    ```bash
    npm install
    ```

3.  Create your server configuration file. Copy `server.conf.example` to `server.conf` and edit the contents.

    > **SECURITY WARNING:** You MUST change the default keys before deploying this application.

    ```json
    {
      "api_key": "your_strong_and_secret_api_key",
      "delete_key": "another_very_strong_and_secret_key",
      "path": {
        "i": "../i",
        "meta": "../meta",
        "client": "../client"
      },
    
      "http": {
        "enabled": true,
        "listen": ":8080"
      },
    
      "https": {
        "enabled": false
      },
    
      "deepface": {
        "url": "http://127.0.0.1:5000/verify",
        "timeout": 15000,
         "model_name": "Facenet",
         "detector_backend": "opencv",
         "distance_metric": "cosine",
         "anti_spoofing": true,
         "align": true,
         "enforce_detection": true
      }
    }
    ```

### 3. Frontend Client Setup

1.  Navigate to the `client` directory.
2.  Edit `config.js` to match your server's URL and API key.
    ```javascript
    // client/js/config.js
    upload.config.server = '' // Empty if the webapp is in the same place as the server
    upload.config.api_key = 'your_strong_and_secret_api_key'; // MUST match the api_key in server.conf
    ```

### 4. DeepFace Server Setup

The facial recognition feature depends on a separate Python server.

1.  Install the `deepface` dependencies:

    ```bash
    pip install -r requirements.txt
    ```

2.  Run the DeepFace API server:

    ```bash
    cd deepface/api/src
    py api.py
    ```

    *(Note: `deepface` will download large machine learning models on its first run.)*

### 5. Running the Application

1.  **Start the DeepFace server** (if you are using it).
2.  **Start the Node.js server** from the `server` directory:
    ```bash
    npm start
    ```
3.  Open your web browser and navigate to the URL of your Node.js server (e.g., `http://localhost:8080`).