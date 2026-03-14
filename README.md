# Verbascope Social ML

Verbascope Social ML is a multi-service backend workspace for a social platform with machine-learning support.

This repository currently contains one active service, auth-service, and scaffolded folders for gateway, feed, post, and ml services.

## Current Status

- auth-service: implemented and runnable
- feed-service: scaffolded (empty)
- post-service: scaffolded (empty)
- ml-service: scaffolded (empty)
- gateway: scaffolded (empty)
- shared: scaffolded (empty)
- docs and docsmkdir: scaffolded (empty)

## Repository Structure

```text
verbascope-social-ml/
	docs/
	docsmkdir/
	gateway/
	services/
		auth-service/
			.env
			package.json
			package-lock.json
			server.js
			src/
				app.js
				config/
					config.js
				controller/
					auth.controller.js
				db/
					db.js
				middlewares/
					validation.middleware.js
				model/
					user.model.js
				routes/
					auth.routes.js
		feed-service/
		ml-service/
		post-service/
	shared/
	README.md
	about.md
```

## Auth Service

The auth-service is an Express + MongoDB service with user registration.

### Implemented Features

- Request logging with morgan
- JSON body parsing
- Cookie parsing
- MongoDB connection bootstrap
- User model with email, fullname, password, googleID, role
- Register endpoint with:
	- input validation
	- duplicate user check
	- bcrypt password hashing
	- JWT creation (2d expiry)
	- auth token cookie
	- password removed from response

### API

Base path:

```text
/api/auth
```

Register endpoint:

```text
POST /api/auth/register
```

Example request body:

```json
{
	"email": "user@example.com",
	"password": "secret123",
	"fullname": {
		"firstName": "Taiyeba",
		"lastName": "Islam"
	}
}
```

### Environment Variables

The auth-service reads environment variables from services/auth-service/.env:

- MONGO_URI
- JWT_SECRET (optional, falls back to a dev default)

## Run Locally (Auth Service)

From services/auth-service:

```bash
npm install
npm run dev
```

Or:

```bash
node server.js
```

The server runs on port 3000.

## Detailed File and Folder Guide

For a detailed explanation of each file and folder, see about.md.