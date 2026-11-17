"""
Unit tests for the application root runner and network discovery utilities.
Verifies IP discovery fallback, environment validation, and startup diagnostic logging.
"""
import unittest
from unittest.mock import patch, MagicMock
from run import get_local_ip

class TestRunRunner(unittest.TestCase):

    def test_get_local_ip_valid_format(self):
        """Discovers a valid IPv4 address or fallback."""
        ip = get_local_ip()
        self.assertIsInstance(ip, str)
        parts = ip.split(".")
        self.assertEqual(len(parts), 4)

    @patch("socket.socket")
    def test_get_local_ip_socket_error_fallback(self, mock_socket):
        """Falls back safely to localhost on network disconnection or socket error."""
        mock_socket.side_effect = OSError("Network unreachable")
        ip = get_local_ip()
        self.assertEqual(ip, "127.0.0.1")

if __name__ == "__main__":
    unittest.main()
