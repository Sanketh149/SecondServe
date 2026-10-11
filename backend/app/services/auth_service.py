from app.models.user import CurrentUser
from app.repositories.memory import InMemoryRepository


class FirebaseAuthService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def resolve_user(self, uid: str) -> CurrentUser | None:
        user = self.repository.get_user(uid)
        if user is None:
            return None
        return CurrentUser(uid=user.uid, role=user.role, organization_id=user.organization_id)
