import { generateKeyPairSync, privateDecrypt, constants } from 'crypto'

let keyPairCache = null

const ensureKeyPair = () => {
  if (!keyPairCache) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })
    keyPairCache = { publicKey, privateKey }
  }
  return keyPairCache
}

export const getPublicKeyPem = () => ensureKeyPair().publicKey

export const decryptWithPrivateKey = (encryptedBase64) => {
  const buffer = Buffer.from(encryptedBase64, 'base64')
  const decrypted = privateDecrypt(
    {
      key: ensureKeyPair().privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    buffer
  )
  return decrypted.toString('utf8')
}
