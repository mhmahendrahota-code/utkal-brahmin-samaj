# 🚀 Zero Cost (₹0) Deployment Guide

Follow these steps to host your website for free forever.

## 1. Get Your API Keys (Free Accounts)

You need to create free accounts on these 3 platforms:

### A. MongoDB Atlas (Database)
1.  Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  Create a **Free Cluster** (Shared).
3.  Go to **Database Access** → Add New Database User (Write down the username and password).
4.  Go to **Network Access** → Add IP Address → Select "Allow Access From Anywhere" (0.0.0.0/0).
5.  Go to **Database** → Connect → Drivers → Copy the **Connection String**.

### B. Cloudinary (Images)
1.  Go to [Cloudinary](https://cloudinary.com/).
2.  Sign up for the **Free Tier**.
3.  On your Dashboard, copy these three:
    - **Cloud Name**
    - **API Key**
    - **API Secret**

### C. Render.com (Hosting)
1.  Go to [Render.com](https://render.com/).
2.  Connect your GitHub repository.

---

## 2. Set Up Environment Variables

In your **Render Dashboard**, go to your Web Service → **Environment** and add these keys:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `MONGODB_URI` | *Your MongoDB Connection String* |
| `SESSION_SECRET` | *A random long string (e.g., `ubs_samaj_2025_secure`)* |
| `CLOUDINARY_CLOUD_NAME` | *From Cloudinary* |
| `CLOUDINARY_API_KEY` | *From Cloudinary* |
| `CLOUDINARY_API_SECRET` | *From Cloudinary* |
| `ADMIN_USERNAME` | *Your choice (e.g., admin)* |
| `ADMIN_PASSWORD` | *Your choice (secure password)* |

---

## 3. Keep the Site Awake (Zero Sleep)

Render's free tier sleeps after 15 minutes of inactivity. To prevent this:

1.  Go to [UptimeRobot](https://uptimerobot.com/) and create a free account.
2.  Click **Add New Monitor**.
3.  Monitor Type: **HTTP(s)**.
4.  Friendly Name: `UBS Website`.
5.  URL: `https://your-app-name.onrender.com/health`
6.  Monitoring Interval: **Every 5 minutes**.

**Congratulations! Your site is now live and will never sleep.** 
