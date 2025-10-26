# Lipodem Takip Paneli - Vercel Deployment Guide

## 🚀 Vercel'e Deploy Etme

### 1. Vercel Hesabı Oluştur
- [vercel.com](https://vercel.com) adresine git
- GitHub hesabınla giriş yap

### 2. Projeyi Import Et
```bash
# Vercel CLI yükle (opsiyonel)
npm i -g vercel

# Proje klasöründe
vercel
```

### 3. Environment Variables Ayarla
Vercel Dashboard > Settings > Environment Variables bölümünden:

**Gerekli Environment Variables:**
- `JWT_SECRET` : Rastgele güvenli bir string (örn: `your-super-secret-jwt-key-2025`)
- `GITHUB_TOKEN` : GitHub Personal Access Token (repo write yetkisiyle)

**GitHub Token Oluşturma:**
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)"
3. Scope: `repo` (tüm repo yetkilerini seç)
4. Token'ı kopyala ve Vercel'de `GITHUB_TOKEN` olarak ekle

### 4. Deployment
```bash
# Production deployment
vercel --prod
```

## 📁 API Endpoints

### POST /api/login
Kullanıcı girişi

**Request:**
```json
{
  "username": "kullanici_adi",
  "password": "sifre"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Giriş başarılı",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "kullanici_adi",
    "role": "patient",
    "fullName": "Ad Soyad",
    "email": "email@example.com"
  }
}
```

### POST /api/change-password
Şifre değiştirme (Auth gerekli)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "currentPassword": "eski_sifre",
  "newPassword": "yeni_sifre"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Şifre başarıyla değiştirildi"
}
```

### POST /api/register-patient
Yeni hasta kaydı (Admin/Dietitian gerekli)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "patientId": "hasta_123",
  "username": "hasta_kullanici",
  "password": "ilk_sifre",
  "fullName": "Hasta Adı Soyadı",
  "email": "hasta@email.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hasta kaydı başarıyla oluşturuldu",
  "patient": {
    "id": "patient_1234567890",
    "patientId": "hasta_123",
    "username": "hasta_kullanici",
    "fullName": "Hasta Adı Soyadı"
  }
}
```

## 🔐 Güvenlik

- Tüm şifreler bcrypt ile hashlenmiş
- JWT token kullanımı (7 gün geçerlilik)
- CORS koruması
- Admin/Dietitian role-based access control

## 📝 Hasta Credentials Yapısı

`data/hasta_credentials.json`:
```json
{
  "version": "1.0",
  "lastUpdated": "2025-10-26T00:00:00.000Z",
  "users": [
    {
      "id": "admin",
      "username": "admin",
      "passwordHash": "$2a$10$...",
      "role": "admin",
      "fullName": "Yönetici",
      "email": "admin@example.com",
      "active": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "patients": [
    {
      "id": "patient_1234567890",
      "patientId": "hasta_001",
      "username": "hasta001",
      "passwordHash": "$2a$10$...",
      "role": "patient",
      "fullName": "Hasta Adı",
      "email": "hasta@email.com",
      "active": true,
      "createdAt": "2025-10-26T00:00:00.000Z",
      "createdBy": "admin"
    }
  ]
}
```

## 🔧 Yerel Geliştirme

```bash
# Dependencies yükle
npm install

# Vercel CLI ile local test
vercel dev

# veya Express sunucusu
npm start
```

## 📌 Notlar

- Her şifre değişikliği GitHub'a otomatik commit edilir
- JWT token localStorage'da `serverJwt` key'i ile saklanır
- Kullanıcı bilgileri `currentUser` key'i ile saklanır
- Varsayılan şifre hashler bcrypt ile salt=10 kullanır

## 🆘 Sorun Giderme

**Problem:** API çalışmıyor
- Vercel environment variables'ları kontrol et
- GitHub token'ın repo write yetkisi olduğundan emin ol

**Problem:** Şifre değiştirme başarısız
- JWT token'ın geçerli olduğundan emin ol
- Mevcut şifrenin doğru olduğundan emin ol

**Problem:** Hasta kaydı oluşturulamıyor
- Admin/Dietitian rolünde olduğundan emin ol
- Kullanıcı adının benzersiz olduğundan emin ol
