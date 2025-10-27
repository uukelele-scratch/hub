const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function deriveKey(master_password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(master_password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const saltBytes = typeof salt === "string" ? new TextEncoder().encode(salt) : salt;

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}


function retrieveMasterPassword() {
  return atob(window.localStorage.getItem('master_password') || '') || null;
}

function a85encode(input) {
    const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
    let result = "";
    for (let i = 0; i < data.length; i += 4) {
        const chunk = data.slice(i, i + 4);
        let num = 0;
        for (let j = 0; j < chunk.length; j++) {
            num = (num * 256) + chunk[j];
        }
        
        const pad = 4 - chunk.length;
        if (pad > 0) {
            const paddedChunk = new Uint8Array(4);
            paddedChunk.set(chunk);
            num = 0;
            for(let j = 0; j < 4; j++) {
                num = (num * 256) + paddedChunk[j];
            }
        }

        if (num === 0 && chunk.length === 4) {
            result += "z";
        } else {
            let block = "";
            for (let j = 0; j < 5; j++) {
                block = String.fromCharCode((num % 85) + 33) + block;
                num = Math.floor(num / 85);
            }
            result += block.slice(0, 5 - pad);
        }
    }
    return result;
}

function a85decode(a85str) {
    const out = [];
    for (let i = 0; i < a85str.length;) {
        if (a85str[i] === "z") {
            out.push(0, 0, 0, 0);
            i++;
            continue;
        }
        
        let chunk = a85str.slice(i, i + 5);
        const pad = 5 - chunk.length;
        if (pad > 0) {
            chunk += "u".repeat(pad);
        }

        let num = 0;
        for (let j = 0; j < chunk.length; j++) {
            const charCode = chunk.charCodeAt(j);
            if (charCode < 33 || charCode > 117) {
                 throw new Error("Invalid Ascii85 character found.");
            }
            num = num * 85 + (charCode - 33);
        }
        
        const bytes = [
            (num >>> 24),
            (num >>> 16) & 0xff,
            (num >>> 8) & 0xff,
            num & 0xff
        ];

        out.push(...bytes.slice(0, 4 - pad));
        i += 5;
    }
    return new Uint8Array(out);
}


export async function encryptJSON(jsonData) {
  const master_password = retrieveMasterPassword();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(master_password, salt);

  const plaintext = textEncoder.encode(JSON.stringify(jsonData));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  ));

  const result = new Uint8Array(salt.length + iv.length + ciphertext.length);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(ciphertext, salt.length + iv.length);

  return a85encode(result);
}

export async function decryptJSON(dataBytes) {
  const data = a85decode(dataBytes);
  const master_password = retrieveMasterPassword();
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  const key = await deriveKey(master_password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(textDecoder.decode(decrypted));
}
