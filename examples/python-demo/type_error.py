def read_user_id(user: dict[str, int] | None) -> int:
    return user["id"]


read_user_id(None)
