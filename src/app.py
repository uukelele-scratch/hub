from hybridoma import App, ViewModel, view_model, expose
from hybridoma.quart import request, redirect
import json
import os
import subprocess as sp
from datetime import datetime

app = App(__name__)

app.config['META_TITLE'] = "Hub."
app.config['META_DESCRIPTION'] = "Hub: A personal-use note-taking app."

@app.context_processor
def inject_common_vars():
    try:
        scheme = request.scheme if hasattr(request, "scheme") else "http"
        host = f"{scheme}://{request.host}"
        url = request.url
    except RuntimeError:
        scheme = "http"
        host = "localhost"
        url = "/"
    return dict(
        host=host,
        url=url,
        meta_title = app.config['META_TITLE'],
        meta_description = app.config['META_DESCRIPTION'],
        meta_image = f"{host}/favicon.ico",
    )

git = os.environ.get("GIT_BINARY", "git")
repo_path = os.environ.get("REPO_PATH", 'hub.data')

class Hub:
    config = {}

    def __init__(self):
        try:
            with open("config.json") as f:
                self.config = json.load(f)
        except FileNotFoundError:
            print("[+] Created `config.json`")
            with open("config.json", 'w') as f:
                json.dump(self.config, f)
                self.config = {}

    def clone(self):
        if os.path.exists(repo_path): return

        token = self.config["github_token"]
        repo = self.config["repo_url"]

        result = sp.run([git, "clone", f"https://{token}@github.com/{repo}.git", repo_path], capture_output=True, text=True, check=True)

        return result.returncode == 0   
   
    def read(self, fp):
        self.clone()
        with open(os.path.join(repo_path, fp), 'rb') as f:
            return f.read()
        
    def write(self, fp, data):
        self.clone()
        with open(os.path.join(repo_path, fp), 'wb') as f:
            f.write(data)

        for cmd in [
            [git, 'add', '.']
            [git, 'commit', '-m', f'"sync-{datetime.now()}"'],
            [git, 'push']
        ]: sp.run(cmd, capture_output=True, text=True, check=True)

hub = Hub()

@expose
def settings(new_settings = None):
    if new_settings:
        hub.config.update(new_settings)
    
    return hub.config

@expose
def clone():
    return hub.clone()

@expose   
def read(fp):
    # Decryption is done in the browser. Master key is never stored here.
    return hub.read(fp)

@expose
def write(fp, data):
    return hub.write(fp, data)

@app.route("/")
async def main():
    return await app.render("index.html")

@app.route("/favicon.ico")
async def favicon():
    return redirect("https://raw.githubusercontent.com/uukelele-scratch/hybridoma/refs/heads/main/.github/assets/hybridoma.png", 301)

if __name__ == "__main__":
    app.run(debug=True, port=8990)