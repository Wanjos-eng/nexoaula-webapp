from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "API"
    VERSION: str = "0.1.0"
    # Sem credenciais de banco por enquanto, como pedido na task

    class Config:
        env_file = ".env"

settings = Settings()