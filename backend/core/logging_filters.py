import logging
import re

PATTERNS = [
    (r'(Bearer\s+)[A-Za-z0-9\-_\.]+', r'\1***'),
    (r'([a-z]+://[^:]+:)([^@]+)(@)', r'\1***\3'),
    (r'(password["\']?\s*[:=]\s*["\']?)[^"\',\s]+', r'\1***'),
    (r'(api[_-]?key["\']?\s*[:=]\s*["\']?)[^"\',\s]+', r'\1***'),
    (r'(token["\']?\s*[:=]\s*["\']?)[^"\',\s]+', r'\1***'),
    (r'(eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)', '***JWT***'),
]


class MaskSensitiveFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        for pattern, repl in PATTERNS:
            msg = re.sub(pattern, repl, msg, flags=re.IGNORECASE)
        record.msg = msg
        record.args = ()
        return True
