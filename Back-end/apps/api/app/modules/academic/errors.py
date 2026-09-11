class AcademicServiceError(Exception):
    """Base class for stable errors exposed by the academic module."""


class ProfileNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Perfil acadêmico não encontrado.")


class InstitutionNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Instituição não encontrada.")


class SubjectNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Disciplina não encontrada.")


class AcademicTermNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Período acadêmico não encontrado.")


class ClassSectionNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Turma não encontrada.")


class EnrollmentAlreadyExistsError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Você já está acompanhando esta turma.")


class EnrollmentNotFoundError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Você não está acompanhando esta turma.")


class InvalidProfileUpdateError(AcademicServiceError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class InstitutionMismatchError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__(
            "A disciplina e o período acadêmico devem pertencer à mesma instituição."
        )


class SubjectAlreadyExistsError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__(
            "Já existe uma disciplina com este nome ou código nesta instituição."
        )


class ClassSectionAlreadyExistsError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__(
            "Já existe uma turma com este rótulo para esta disciplina e período."
        )


class AcademicPersistenceError(AcademicServiceError):
    def __init__(self) -> None:
        super().__init__("Não foi possível persistir a operação acadêmica.")
