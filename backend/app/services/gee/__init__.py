"""Google Earth Engine integration.

Earth Engine is imported lazily so the API can still serve stored observations
when the optional dependency or credentials are unavailable.
"""

from .gee_client import EarthEngineClient, GeeHealth

__all__ = ["EarthEngineClient", "GeeHealth"]

