from pydantic import BaseModel, Field, field_validator
import re


class Login(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="The six-digit assignment demo verification code.",
    )
    display_name: str = Field(default="", max_length=60)
    avatar: str = Field(default="blue", max_length=300000)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9_+.\-]{3,40}", v):
            raise ValueError(
                "Use 3–40 letters, numbers, underscores, or a phone number without spaces."
            )
        return v


class Profile(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)
    avatar: str = Field(max_length=300000)


class Contact(BaseModel):
    username: str = Field(min_length=3, max_length=40)


class ConversationCreate(BaseModel):
    kind: str = "direct"
    name: str = Field(default="", max_length=80)
    member_ids: list[int] = Field(max_length=100)


class MemberAdd(BaseModel):
    user_id: int


class MessageCreate(BaseModel):
    body: str = Field(default="", max_length=10000)
    client_id: str = Field(min_length=1, max_length=100)
    reply_to: int | None = None
    attachment_id: str | None = None


class Receipt(BaseModel):
    message_ids: list[int] = Field(max_length=500)
    status: str


class Reaction(BaseModel):
    emoji: str


class Timer(BaseModel):
    seconds: int
