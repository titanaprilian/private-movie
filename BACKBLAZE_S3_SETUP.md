# Backblaze B2 (S3) Setup Guide

This guide walks through configuring Backblaze B2 object storage for `private-movie` to support direct video uploads and authenticated playback streams for Web and Android TV clients.

---

## 1. Create a Bucket in Backblaze B2

1. Sign in to your [Backblaze B2 Console](https://secure.backblaze.com/b2_buckets.htm).
2. Click **Create a Bucket**:
   - **Bucket Unique Name**: Enter a globally unique name (e.g. `private-movie-storage`).
   - **Files in Bucket are**: Select **Private** (presigned URLs will secure playback).
   - **Default Encryption**: Disable or Enable (SSE-B2 is fine).
   - **Object Lock**: Disabled.
3. Once created, click on your bucket details to find:
   - **Endpoint**: e.g. `s3.us-east-005.backblazeb2.com`
   - **Region**: Extracted from the endpoint (e.g. `us-east-005`).

---

## 2. Generate Application Key Credentials

1. In the left sidebar, select **Application Keys**.
2. Scroll down and click **Add a New Application Key**:
   - **Name of key**: `private-movie-backend`
   - **Allow access to Bucket(s)**: Select your newly created bucket (or "All").
   - **Type of Access**: `Read and Write`.
3. Click **Create New Key**.
4. **Copy credentials immediately**:
   - `keyID`: Maps to `S3_ACCESS_KEY_ID`.
   - `applicationKey`: Maps to `S3_SECRET_ACCESS_KEY` _(Backblaze displays this only once!)_.

---

## 3. Configure CORS Rules for Direct Uploads

Because video files are uploaded directly from the browser to Backblaze B2 using presigned S3 PUT URLs, CORS must be enabled on your bucket:

1. In the B2 console, go to **Buckets** -> find your bucket -> click **Bucket Settings**.
2. Under **CORS Rules**, select **Share everything in this bucket with all origins** or configure custom rules:
   ```json
   [
     {
       "corsRuleName": "allowDirectUploads",
       "allowedOrigins": [
         "http://localhost:5173",
         "http://localhost:3000",
         "*"
       ],
       "allowedOperations": ["s3_put", "s3_get", "s3_head", "b2_upload_file"],
       "allowedHeaders": ["*"],
       "exposeHeaders": ["ETag"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
3. Save the bucket settings.

---

## 4. Set Environment Variables

Add the following configuration to `apps/backend/.env` (and optionally root `.env`):

```bash
# S3 / Backblaze B2 Object Storage
S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
S3_REGION=us-east-005
S3_BUCKET=private-movie-storage
S3_ACCESS_KEY_ID=your_keyID_here
S3_SECRET_ACCESS_KEY=your_applicationKey_here

# Optional: presigned GET playback URL TTL in seconds (default: 21600 = 6 hours)
S3_PRESIGNED_GET_EXPIRES_IN=21600
```

> **Note**: If S3 variables are not set or left blank, the backend will safely run in fallback mode with S3 functionality disabled.

---

## 5. How It Works

1. **Upload**:
   - Admin sends `POST /api/media/episodes/:id/sources/presign-upload` with `{ filename: "my-video.mp4", contentType: "video/mp4" }`.
   - Backend returns `{ uploadUrl, key }`.
   - Admin client performs an HTTP `PUT` with the video file binary directly to `uploadUrl`.
2. **Registration**:
   - Admin registers the source: `POST /api/media/episodes/:id/sources` with:
     ```json
     {
       "videoSources": [
         {
           "type": "s3",
           "url": "episodes/<episodeId>/<uuid>-my-video.mp4",
           "label": "1080p (Direct)",
           "quality": "1080p"
         }
       ]
     }
     ```
3. **Playback (Web & Android TV)**:
   - When a client calls `GET /api/media/episodes/:id` or `GET /api/media/series/:id`, the backend automatically resolves any source with `type: "s3"` into an active presigned GET playback URL with a 6-hour expiration.
   - ExoPlayer / HTML5 video player streams the file directly with no extra authentication logic required on the client.
4. **Cleanup**:
   - Deleting a source (`DELETE /api/media/episodes/:id/sources/:sourceId`) or episode (`DELETE /api/media/episodes/:id`) automatically deletes the corresponding file(s) from your Backblaze B2 bucket.
