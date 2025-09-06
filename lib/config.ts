export const config = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  },
} as const

// Environment değişkenlerinin varlığını kontrol et
Object.entries(config).forEach(([category, values]) => {
  Object.entries(values).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`Missing environment variable: ${category}.${key}`)
    }
  })
})