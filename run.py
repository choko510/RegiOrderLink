import uvicorn
import sys
sys.path.append('backend')
from app.main import app

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="localhost", port=8000, reload=True)