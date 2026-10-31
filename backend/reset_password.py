
from getpass import getpass

from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def main():
    db: Session = SessionLocal()

    try:
        user_id_input = input("Enter the user ID to reset: ").strip()

        if not user_id_input.isdigit():
            print("Please enter a valid numeric user ID.")
            return

        user_id = int(user_id_input)
        user = db.query(User).filter(User.id == user_id).first()

        if user is None:
            print("User not found.")
            return

        print(f"Account found: {user.email}")

        new_password = getpass("Enter the new password: ")
        confirm_password = getpass("Confirm the new password: ")

        if len(new_password) < 8:
            print("Password must contain at least 8 characters.")
            return

        if new_password != confirm_password:
            print("Passwords do not match.")
            return

        user.password_hash = password_hash.hash(new_password)
        db.commit()

        print(f"Password reset successfully for user ID {user_id}.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
