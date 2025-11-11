# hub

An encrypted, AI-integrated, personal knowledge base with github-based synchronization.

## Why?

Your data, in your control. Data is end-to-end encrypted - the password never leaves your browser.

## Features

- AES-256-GCM encryption
- Synchronization with a git repository.
- AI chat integration
- Markdown note-taking with calendar-based organization
- Built with [hybridoma](https://github.com/uukelele-scratch/hybridoma)

## Installation

### Running with Docker

```
git clone https://github.com/uukelele-scratch/hub.git
cd hub
cp .env.example .env # Create your .env as described below.
docker compose up --build # -d
```

### Requirements

- `git`
- Python
- GitHub account for syncing.

### Setup

- **GitHub Repository** - Create a private repository on GitHub.
- **Personal Access Token** - Create a PAT on GitHub with scopes to read/write content of the repo.

### Installation

```
git clone https://github.com/uukelele-scratch/hub.git
cd hub
python -m venv .venv
. .venv/bin/activate # windows: .\venv\Scripts\activate
python -m pip install -r requirements.txt
```

### Configuration

Create an .env file for your secrets.
You can copy the example:

```
cp .env.example .env
```

Edit the .env with the correct data.

### Run

```
# For local testing:
python src/app.py
# For production:
hypercorn src.app:app --bind 0.0.0.0:8990
```

Open `http://localhost:8990` in your browser.
