from hybridoma import App
from hybridoma.quart import request, redirect

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

@app.route("/")
async def main():
    return await app.render("index.html")

@app.route("/favicon.ico")
async def favicon():
    return redirect("https://raw.githubusercontent.com/uukelele-scratch/hybridoma/refs/heads/main/.github/assets/hybridoma.png", 301)

if __name__ == "__main__":
    app.run(debug=True, port=8990)