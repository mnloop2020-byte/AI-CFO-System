class RecordNotFoundError(ValueError):
    pass


class RecordConflictError(ValueError):
    pass


def is_constraint_error(error: Exception, *codes: str) -> bool:
    code = str(getattr(error, "code", ""))
    text = str(error)
    return code in codes or any(candidate in text for candidate in codes)
