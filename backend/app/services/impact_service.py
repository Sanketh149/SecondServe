from app.repositories.memory import InMemoryRepository


class ImpactService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def summary(self, organization_id: str) -> dict:
        return self.repository.get_impact(organization_id)
