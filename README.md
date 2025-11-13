# SecureFileX

© 2025 Ausca Lai Meng Hin <br>

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Version](https://img.shields.io/badge/Version-1.0.0-green.svg) ![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)

A privacy-focused, client-side encrypted file and memo sharing platform with advanced 2-Factor Authentication.




---

## Table of Contents

- [Features](#-features)
- [Security Architecture](#-security-architecture)
- [Technology Stack](#️-technology-stack)
- [Setup and Installation](#️-setup-and-installation)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Backend Server Setup](#2-backend-server-setup)
  - [3. Frontend Client Setup](#3-frontend-client-setup)
  - [4. DeepFace Server Setup](#4-deepface-server-setup)
  - [5. Running the Application](#5-running-the-application)

---

## Features

SecureFile Locker is built with a zero-knowledge philosophy. The server has no access to user passwords or unencrypted files. All cryptography happens in the browser.

| Feature                      | Status | Description                                                                                             |
| ---------------------------- | :----: | ------------------------------------------------------------------------------------------------------- |
| **End-to-End Encryption**    |   ✅    | Files are encrypted/decrypted in-browser using **AES-256-CCM**.                                         |
| **Password Protection**      |   ✅    | Encryption keys are derived from a user's password using **PBKDF2**.                                    |
| **Facial Recognition 2FA**   |   ✅    | Verify identity using a webcam before decryption. Powered by DeepFace.                                  |
| **Anti-Spoofing**            |   ✅    | The DeepFace server can be configured to detect and reject non-live faces.                              |
| **TOTP Authenticator 2FA**   |   ✅    | Supports Google Authenticator, Authy, and other TOTP apps.                                              |
| **Configurable Expiration**  |   ✅    | Users can set files to self-destruct after a specific time (hours or days).                             |
| **Automatic Deletion**       |   ✅    | A server-side cron job automatically and permanently deletes expired files.                             |
| **Secure Manual Deletion**   |   ✅    | Each upload provides a unique deletion key for immediate file removal.                                  |
| **Modern Responsive UI**     |   ✅    | A sleek, animated dark-mode interface built with Bootstrap 5.                                           |
| **Text Memos & File Upload** |   ✅    | Supports both direct text pasting (memos) and file uploads.                                             |

---

## Security Architecture

Security is the core principle of this project. The server is designed to be a "dumb" host for encrypted blobs, unable to access the content it stores.

1.  **Key Derivation:**
    `User Password` + `Random Salt` → `PBKDF2` → `AES-256 Key`

2.  **File Encryption (In Browser):**
    `Original File` + `AES-256 Key` → `AES-256-CCM Encryption` → `Encrypted File Blob`

3.  **2FA Secret Protection (Hybrid Encryption):**
    When a user adds 2FA (Face or TOTP), the sensitive secret is not stored plaintext.
    -   The browser generates a temporary, single-use symmetric key.
    -   This key is used to encrypt the 2FA secret (`TOTP secret` or initial `face data URI`) with **AES**.
    -   The temporary key is then encrypted with the server's **Elliptic Curve Cryptography (ECC)** public key.
    -   This small, doubly-encrypted package is appended to the main file blob. The server can only decrypt the temporary key (using its ECC private key) after a successful 2FA challenge, just before serving the file for final decryption in the user's browser.

4.  **Secure Deletion:**
    -   **Manual:** A `delkey` is generated from the server's secret key and the file's unique ID (`ident`). Only the user receives this key, which authorizes a deletion request.
    -   **Automatic:** A server-side cron job runs every 5 minutes, checks the `meta` directory for files with expired timestamps, and deletes both the metadata and the encrypted file from the disk.

---

## Technology Stack

### Frontend

-   **HTML5, CSS3, JavaScript (ES6)**
-   [**Zepto.js**](https://zeptojs.com/): A lightweight, jQuery-compatible library for DOM manipulation and AJAX.
-   [**Bootstrap 5**](https://getbootstrap.com/): For modern, responsive UI components and layout.
-   [**anime.js**](https://animejs.com/): For smooth and performant UI animations.
-   **Webcam-easy.js:** For accessing the user's camera for facial recognition.
-   **Stanford Javascript Crypto Library (SJCL):** For all client-side cryptographic operations (AES, PBKDF2, ECC).

### Backend

-   [**Node.js**](https://nodejs.org/) with [**Express.js**](https://expressjs.com/): For the web server and API endpoints.
-   **Speakeasy:** For generating and verifying TOTP codes.
-   **QRCode:** For generating QR codes for TOTP setup.
-   **node-schedule:** For running the automatic file deletion cron job.

### External Services

-   **Python DeepFace Server:** A separate Python server running the `deepface` library is required for the facial recognition feature.

---

## ⚙️ Setup and Installation

### 1. Prerequisites

-   [**Node.js**](https://nodejs.org/en/download/) (v16 or later) and npm.
-   [**Python**](https://www.python.org/downloads/) (v3.8 or later) and pip.
-   A command-line interface (Terminal, PowerShell, etc.).

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
      "http": { "enabled": true, "listen": ":8080" }
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

1.  Install the required Python libraries:
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: `deepface` will download large machine learning models on its first run.)*


2.  Run the DeepFace server from its folder: (deepface/api/src/api.py)
    ```bash
    python api.py
    ```

### 5. Running the Application

1.  **Start the DeepFace server** (if you haven't already).
2.  **Start the Node.js server** from the `server` directory:
    ```bash
    npm start
    ```
3.  Open your web browser and navigate to the URL of your Node.js server (e.g., `http://localhost:8080`).

---
