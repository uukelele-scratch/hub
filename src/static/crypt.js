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
  return atob(window.masterPassword || '') || null;
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

  return result;
}

export async function decryptJSON(dataBytes) {
  const master_password = retrieveMasterPassword();
  const salt = dataBytes.slice(0, 16);
  const iv = dataBytes.slice(16, 28);
  const ciphertext = dataBytes.slice(28);

  const key = await deriveKey(master_password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(textDecoder.decode(decrypted));
}
