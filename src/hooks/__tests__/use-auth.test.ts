import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mocks
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockAnonWork = {
  messages: [{ role: "user", content: "Hello" }],
  fileSystemData: { "/app.tsx": { type: "file", content: "code" } },
};

const mockProjects = [
  { id: "proj-1", name: "Project 1" },
  { id: "proj-2", name: "Project 2" },
];

const mockCreatedProject = { id: "new-proj-123", name: "New Design" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    describe("happy path — anon work with messages", () => {
      test("creates project from anon work, clears it, and navigates", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(mockAnonWork);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: mockAnonWork.messages,
            data: mockAnonWork.fileSystemData,
          })
        );
        expect(clearAnonWork).toHaveBeenCalledOnce();
        expect(mockPush).toHaveBeenCalledWith(`/${mockCreatedProject.id}`);
        expect(getProjects).not.toHaveBeenCalled();
      });
    });

    describe("happy path — no anon work, existing projects", () => {
      test("navigates to the most recent project", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${mockProjects[0].id}`);
        expect(createProject).not.toHaveBeenCalled();
      });
    });

    describe("happy path — no anon work, no existing projects", () => {
      test("creates a new project and navigates to it", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith(`/${mockCreatedProject.id}`);
      });
    });

    describe("error path — failed sign-in", () => {
      test("returns the failure result without navigating", async () => {
        const failResult = { success: false, error: "Invalid credentials" };
        vi.mocked(signInAction).mockResolvedValue(failResult);

        const { result } = renderHook(() => useAuth());
        let returnValue: any;

        await act(async () => {
          returnValue = await result.current.signIn("user@example.com", "wrong");
        });

        expect(returnValue).toEqual(failResult);
        expect(mockPush).not.toHaveBeenCalled();
        expect(getProjects).not.toHaveBeenCalled();
        expect(createProject).not.toHaveBeenCalled();
      });
    });

    describe("loading state", () => {
      test("sets isLoading to true during the call and false after", async () => {
        let resolveSignIn!: (v: any) => void;
        vi.mocked(signInAction).mockReturnValue(
          new Promise((r) => (resolveSignIn = r))
        );
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        let signInPromise: Promise<any>;
        act(() => {
          signInPromise = result.current.signIn("user@example.com", "pass");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignIn({ success: true });
          await signInPromise!;
        });

        expect(result.current.isLoading).toBe(false);
      });

      test("resets isLoading to false even when signInAction throws", async () => {
        vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "pass").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("anon work with empty messages falls through to getProjects", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith(`/${mockProjects[0].id}`);
      });

      test("returns the result object from signInAction", async () => {
        const successResult = { success: true };
        vi.mocked(signInAction).mockResolvedValue(successResult);
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

        const { result } = renderHook(() => useAuth());
        let returnValue: any;

        await act(async () => {
          returnValue = await result.current.signIn("user@example.com", "pass");
        });

        expect(returnValue).toEqual(successResult);
      });

      test("forwards email and password to signInAction", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: false });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@test.com", "mypassword");
        });

        expect(signInAction).toHaveBeenCalledWith("test@test.com", "mypassword");
      });
    });
  });

  describe("signUp", () => {
    describe("happy path — anon work with messages", () => {
      test("creates project from anon work, clears it, and navigates", async () => {
        vi.mocked(signUpAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(mockAnonWork);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: mockAnonWork.messages })
        );
        expect(clearAnonWork).toHaveBeenCalledOnce();
        expect(mockPush).toHaveBeenCalledWith(`/${mockCreatedProject.id}`);
      });
    });

    describe("happy path — no anon work, existing projects", () => {
      test("navigates to the most recent project", async () => {
        vi.mocked(signUpAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue(mockProjects as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith(`/${mockProjects[0].id}`);
      });
    });

    describe("happy path — no anon work, no existing projects", () => {
      test("creates a new project and navigates to it", async () => {
        vi.mocked(signUpAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith(`/${mockCreatedProject.id}`);
      });
    });

    describe("error path — failed sign-up", () => {
      test("returns the failure result without navigating", async () => {
        const failResult = { success: false, error: "Email already registered" };
        vi.mocked(signUpAction).mockResolvedValue(failResult);

        const { result } = renderHook(() => useAuth());
        let returnValue: any;

        await act(async () => {
          returnValue = await result.current.signUp("taken@example.com", "pass123");
        });

        expect(returnValue).toEqual(failResult);
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("loading state", () => {
      test("sets isLoading to true during the call and false after", async () => {
        let resolveSignUp!: (v: any) => void;
        vi.mocked(signUpAction).mockReturnValue(
          new Promise((r) => (resolveSignUp = r))
        );
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        let signUpPromise: Promise<any>;
        act(() => {
          signUpPromise = result.current.signUp("new@example.com", "pass");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignUp({ success: true });
          await signUpPromise!;
        });

        expect(result.current.isLoading).toBe(false);
      });

      test("resets isLoading to false even when signUpAction throws", async () => {
        vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "pass").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("forwards email and password to signUpAction", async () => {
        vi.mocked(signUpAction).mockResolvedValue({ success: false });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("signup@test.com", "securepass");
        });

        expect(signUpAction).toHaveBeenCalledWith("signup@test.com", "securepass");
      });

      test("new project name includes random number when no projects exist", async () => {
        vi.mocked(signUpAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue(mockCreatedProject as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        const callArg = vi.mocked(createProject).mock.calls[0][0];
        expect(callArg.name).toMatch(/^New Design #\d+$/);
      });
    });
  });

  describe("signIn and signUp independence", () => {
    test("two sequential calls both reset isLoading correctly", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false });
      vi.mocked(signUpAction).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.signUp("a@b.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);
    });
  });
});
