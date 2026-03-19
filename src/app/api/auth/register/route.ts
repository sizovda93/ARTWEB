import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-password";
import { generateToken, getEmailTokenExpiresAt } from "@/lib/auth-tokens";
import { registerSchema } from "@/lib/validation";
import { AuthError } from "@/lib/auth";
import { logSecurityEvent, getClientIp } from "@/lib/security-log";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);
    const emailLower = input.email.toLowerCase();

    // Check uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    });
    if (existing) {
      throw new AuthError("CONFLICT", "Пользователь с таким email уже существует");
    }

    const passwordHash = await hashPassword(input.password);
    const emailToken = generateToken();

    // Transaction: create user + email token + optional referral
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      await tx.emailToken.create({
        data: {
          userId: newUser.id,
          tokenDigest: emailToken.digest,
          type: "VERIFICATION",
          expiresAt: getEmailTokenExpiresAt(),
        },
      });

      // Handle referral code (silent fail — don't block registration)
      if (input.referralCode) {
        const partner = await tx.partnerProfile.findUnique({
          where: { referralCode: input.referralCode },
          select: { id: true, isApproved: true },
        });
        if (partner?.isApproved) {
          await tx.partnerReferral.create({
            data: {
              partnerProfileId: partner.id,
              referredUserId: newUser.id,
              event: "REGISTRATION",
            },
          });
        }
      }

      return newUser;
    });

    // TODO: Send verification email with emailToken.raw
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[DEV] Email verification token for ${user.email}: ${emailToken.raw}`,
      );
    }

    await logSecurityEvent({
      userId: user.id,
      action: "REGISTER",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Register");
  }
}
