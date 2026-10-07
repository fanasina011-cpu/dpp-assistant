import logging
from pathlib import Path

from core.logging_filters import MaskSensitiveFilter
from django.conf import settings
from django.test import TestCase


class LoggingConfigTest(TestCase):
    def test_logging_configured(self):
        self.assertIn('handlers', settings.LOGGING)
        handlers = settings.LOGGING['handlers']
        self.assertIn('console', handlers)
        self.assertIn('file_general', handlers)
        self.assertIn('file_errors', handlers)

    def test_info_written_to_file(self):
        logger = logging.getLogger('api')
        logger.info('CI test log message')
        for handler in logging.getLogger('api').handlers:
            handler.flush()
        log_path = settings.LOGGING['handlers']['file_general']['filename']
        self.assertTrue(log_path.exists())
        content = log_path.read_text(encoding='utf-8')
        self.assertIn('CI test log message', content)


class MaskSensitiveFilterTest(TestCase):
    def setUp(self):
        self.filter = MaskSensitiveFilter()

    def _mask(self, message):
        record = logging.LogRecord(
            name='test', level=logging.INFO, pathname='', lineno=0,
            msg=message, args=(), exc_info=None,
        )
        self.filter.filter(record)
        return record.msg

    def test_masque_bearer_token(self):
        msg = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig'
        self.assertNotIn('eyJhbGciOiJIUzI1NiJ9', self._mask(msg))

    def test_masque_password_dans_url(self):
        msg = 'Connexion à postgres://user:secret123@db:5432/dpp'
        self.assertNotIn('secret123', self._mask(msg))

    def test_masque_password_kwarg(self):
        msg = 'login failed password=secret123'
        self.assertNotIn('secret123', self._mask(msg))

    def test_masque_api_key(self):
        msg = 'api_key="abc123def456"'
        self.assertNotIn('abc123def456', self._mask(msg))

    def test_masque_jwt_brut(self):
        msg = 'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_ici'
        self.assertNotIn('eyJhbGciOiJIUzI1NiJ9', self._mask(msg))

    def test_message_normal_non_modifie(self):
        msg = 'Utilisateur créé avec succès'
        self.assertEqual(self._mask(msg), 'Utilisateur créé avec succès')
