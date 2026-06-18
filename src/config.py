import tomllib as toml
import os

class Config:

    __CONFIG_FILE = "config.toml"

    def __init__(self):
        """
        Load the toml config file
        """
        self.config = self._load_config()

    def _load_config(self) -> dict:
        """
        Load the toml config file
        """
        if not os.path.exists(self.__CONFIG_FILE):
            raise FileNotFoundError(f"Config file {self.__CONFIG_FILE} not found")
        with open(self.__CONFIG_FILE, "rb") as f:
            return toml.load(f)

    def get(self, key: str, default=None):
        """
        Get a config value by key
        """
        return self.config.get(key, default)