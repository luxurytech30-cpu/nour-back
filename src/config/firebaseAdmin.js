const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "nour-4a810",
      clientEmail: "firebase-adminsdk-fbsvc@nour-4a810.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCvhlksdVDoHhfc\niUQo7wNTHKE6hLtM+9qm0ArPYxpeyHMO62CUvsB7DdPZCBCXIMbU/Ih47v1X0hXV\nkzci6n5tv6mlJpvAvse/bhT8K3wfQ1s6htW0zAqgv4lvWxNrVbD1ilPZil5g4HOf\naeaglf7tggs2p47k5Cm7SlMn+V5HESI5BVmqmGKjWghewkcLBAqfuBLvwBkAQfap\nFCBtYiehDY4WxtHqV/WnxlNZVDvidWlne+h2FUDt+9gjmILSO9cAqOS8bLtQMYGD\ngAJzxZM56Fjth9EyNmgzwPojsFnuBRjvuXMpS1zJaiYQgw3oIIToQhWVDv6QdU/y\nnSGnSu8jAgMBAAECggEAC4KCT3WD8CylAOupYgvGSolqkyVICPTM8jpbMx07CfMY\nBGbv5uEZSxhth2JNgDOAhk/m/RMi3sLidqZYK7x3vOegDrnY5cs82vMzghOx6HTo\nww47bkcg/UiCESDGRbgRShCfjfjSVoTxYAc4PdiIJnfsF1Hmf2Ds0aC+kjT6dytv\nFvv/Vu4B3PLXQ9+pGLtNZd0TtnPrVXkMfmpi2F+5M1CtUh3rhj2XUybJyxug1c21\ndZ0gAppfxZkw47s/6EAMslpsT+vkY0i3IFTQEe0YVIv91Yh/moy6S1f/MalDEifm\n+4VkD29lSwiJJd5DwUA1sHt3860HeCFxvNWVazCMzQKBgQDi9sfkx1jixXgaWS8l\nyE6ZiQYaa1XqRWKLECKZDr15jD845aCqy/Puosv0jklWaerhC/7RrYwnjAkbNilY\nYWVZ05YpjOHljMoCaKBow3ruALafrkVlzjd6zVZLQMIKPCLn8IiiqLyu9pq1s6dN\nWgtrU9o12Qmb9W1x91SipaxbvQKBgQDF+uZ+3rM5wYuKjsSLa3137eQ+LpjWktG4\npxkvwdorQ6oqfjAXrj6GRnfMFGCXK7k/z/EnHyBxZfEKfdosldVFXX79Kw/793Y+\nzAHMk5lZ60m1GwV4wtcsihx+9A9MiuWbv/62Ls0BQTuL+pqLxobSWliJ6nyD/Bq6\njQfZHmS0XwKBgHLnUz38uoBcTriwLBFpvnk2iNN5Qc7P/9q9eXaZos1VdnB8uIGf\nrchDvRP7sR9BkjsLEp/ex9UBrV6MZhQrgt8eIqi4fWj0hRUBGSzQwnyZ+dsPpGyt\nISNXr3d7uoDp/xYDjXkkChpeGOcio/GiQ6O7mP6n+ZhugVEwUTXiwEbVAoGBAKbX\nOvl9uXIZvfulNtL7Yb/4lVklsZ1aGyzOfLY3WiENo9CtiN/b8kr8BabRIVkj+rhh\nB6vdWlzV+NzLlFnwZstO8F5vtMe1Ekv3Zii91gTl+LaLr//Fysl5FmySRnZNsxOf\nKArlw9Oj4oejSCw0wJdylZycJBSiFvBRO2TobRtnAoGAM2Gk9cLhUKZr1cV4xiFV\nlnibGFoP9TLEgIk4WGVKOvNXiXiATuGZPRkaNFAjUct6eIY0q4FPbhZMy3uDSNfd\ndPDcgcfbwAXj0t95Ugc7hULqGVwibdWrdUp0ZV72IrMHZapYtCQf/EOJvVNVA6VH\na6h45rXqXoGD1VLUCnORqHg=\n-----END PRIVATE KEY-----\n?.replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = admin;
