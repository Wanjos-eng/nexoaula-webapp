from uuid import UUID, uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.academic.models import (
    Institution,
    Course,
    Subject,
    AcademicTerm,
    ClassSection, Teacher, ClassSectionTeacher,
)
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    InstitutionResponse,
    CourseResponse,
    SubjectResponse,
    AcademicTermResponse,
    ClassSectionResponse, TeacherResponse, ClassSectionTeacherResponse, TopicResponse, SubjectTopicResponse,
    CatalogKind,
    Output,
)
from app.modules.users.profile_access import ProfileAccess

from app.modules.community.models import Topic, SubjectTopic

CATALOG = {
    "teachers": (Teacher, TeacherResponse),
    "class-section-teachers": (ClassSectionTeacher, ClassSectionTeacherResponse),
    "topics": (Topic, TopicResponse),
    "subject-topics": (SubjectTopic, SubjectTopicResponse),
    "institutions": (Institution, InstitutionResponse),
    "courses": (Course, CourseResponse),
    "subjects": (Subject, SubjectResponse),
    "academic-terms": (AcademicTerm, AcademicTermResponse),
    "class-sections": (ClassSection, ClassSectionResponse),
}


class SqlAlchemyAcademicRepository:
    def __init__(self, session: Session):
        self._session = session
        self._profiles = ProfileAccess(session)

    def get_profile(self, user_id: UUID) -> AcademicProfileResponse | None:
        profile = self._profiles.get(user_id)
        return AcademicProfileResponse.model_validate(profile) if profile else None

    def update_profile(self, user_id, updates):
        return AcademicProfileResponse.model_validate(
            self._profiles.update(user_id, updates)
        )

    def get(self, kind: CatalogKind, item_id: UUID) -> Output | None:
        model, response = CATALOG[kind]
        row = self._session.get(model, item_id)
        return response.model_validate(row) if row else None

    def add(self, kind: CatalogKind, values: dict[str, object]) -> Output:
        model, response = CATALOG[kind]
        row = model(id=uuid4(), **values)
        self._session.add(row)
        self._session.flush()
        return response.model_validate(row)

    def list(self, kind, institution_id, subject_id, limit, offset):
        model, response = CATALOG[kind]
        query = select(model)
        if institution_id is not None and hasattr(model, "institution_id"):
            query = query.where(model.institution_id == institution_id)
        if subject_id is not None and kind in {"class-sections", "subject-topics"}:
            query = query.where(model.subject_id == subject_id)
        if institution_id is not None and kind == "subject-topics":
            query = query.join(Subject, Subject.id == SubjectTopic.subject_id).where(Subject.institution_id == institution_id)
        if subject_id is not None and kind == "class-section-teachers":
            query = query.join(ClassSection, ClassSection.id == ClassSectionTeacher.class_section_id).where(ClassSection.subject_id == subject_id)
        label = next((getattr(model, field) for field in ("name", "label", "full_name", "display_order", "starts_on") if hasattr(model, field)), model.id)
        rows = self._session.scalars(
            query.order_by(label, model.id).limit(limit).offset(offset)
        )
        return [response.model_validate(row) for row in rows]
