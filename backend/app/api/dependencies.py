from typing import Annotated

from fastapi import Depends, HTTPException, Header, Request
import firebase_admin
from firebase_admin import auth

from app.api import errors
from app.config import get_settings
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
settings = get_settings()


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
) -> CurrentUser:
    if settings.demo_mode and x_demo_user:
        user = get_repository().get_user(x_demo_user)
        if user is None:
            raise errors.SecondServeError(401, "INVALID_DEMO_USER", "The demo user does not exist.")
        return CurrentUser(uid=user.uid, role=user.role, organization_id=user.organization_id)
    if not authorization or not authorization.startswith("Bearer "):
        raise errors.SecondServeError(401, "UNAUTHORIZED", "A Firebase ID token is required.")
    try:
        if not firebase_admin._apps:
            options = (
                {"projectId": settings.firebase_project_id}
                if settings.firebase_project_id
                else None
            )
            firebase_admin.initialize_app(options=options)
        token = auth.verify_id_token(
            authorization.removeprefix("Bearer "),
            app=firebase_admin.get_app(),
        )
    except Exception as exc:
        raise errors.SecondServeError(401, "INVALID_AUTH_TOKEN", "The Firebase ID token is invalid.") from exc
    user = get_repository().get_user(token["uid"])
    if user is None:
        raise errors.SecondServeError(403, "USER_NOT_FOUND", "No application profile was found for this user.")
    return CurrentUser(uid=user.uid, role=user.role, organization_id=user.organization_id)


def require_role(*roles: str):
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role.value not in roles:
            raise errors.SecondServeError(403, "FORBIDDEN", "The authenticated user cannot perform this action.")
        return user
    return dependency
