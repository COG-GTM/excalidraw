import { fireEvent, render as rtlRender } from "@testing-library/react";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import { actionGoToCollaborator } from "./actionNavigate";

import type { Mock } from "vitest";

import type { GoToCollaboratorComponentProps } from "../components/UserList";
import type {
  Collaborator,
  OnUserFollowedPayload,
  SocketId,
  UserToFollow,
} from "../types";

const { h } = window;

const socketId = (id: string) => id as SocketId;

const renderPanel = (data: GoToCollaboratorComponentProps) =>
  rtlRender(<>{h.app.actionManager.renderAction("goToCollaborator", data)}</>);

describe("actionGoToCollaborator", () => {
  let onUserFollow: Mock<(payload: OnUserFollowedPayload) => void>;

  const renderEditor = async (userToFollow: UserToFollow | null = null) => {
    onUserFollow = vi.fn();
    await render(
      <Excalidraw onUserFollow={onUserFollow} userToFollow={userToFollow} />,
    );
  };

  const execute = (collaborator: Collaborator) => {
    act(() => {
      h.app.actionManager.executeAction(
        actionGoToCollaborator,
        "ui",
        collaborator,
      );
    });
  };

  describe("perform", () => {
    it("emits a FOLLOW intent for another collaborator and closes the canvas menu", async () => {
      await renderEditor();
      API.setAppState({ openMenu: "canvas" });

      execute({ socketId: socketId("s1"), username: "Ada" });

      expect(onUserFollow).toHaveBeenCalledTimes(1);
      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: { socketId: "s1", username: "Ada" },
        action: "FOLLOW",
      });
      expect(h.state.openMenu).toBe(null);
    });

    it("uses an empty username when the collaborator has none", async () => {
      await renderEditor();
      API.setAppState({ openMenu: null });

      execute({ socketId: socketId("s1") });

      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: { socketId: "s1", username: "" },
        action: "FOLLOW",
      });
      expect(h.state.openMenu).toBe(null);
    });

    it("unfollows when clicking the collaborator that is already being followed", async () => {
      const followed = { socketId: socketId("s1"), username: "Ada" };
      await renderEditor(followed);
      API.setAppState({ openMenu: "canvas" });

      execute({ socketId: socketId("s1"), username: "Ada" });

      expect(onUserFollow).toHaveBeenCalledTimes(1);
      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: followed,
        action: "UNFOLLOW",
      });
      expect(h.state.openMenu).toBe("canvas");
    });

    it("unfollows the current target when clicking the current user", async () => {
      const followed = { socketId: socketId("s1"), username: "Ada" };
      await renderEditor(followed);

      execute({ socketId: socketId("me"), isCurrentUser: true });

      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: followed,
        action: "UNFOLLOW",
      });
    });

    it("unfollows when the collaborator has no socket id", async () => {
      const followed = { socketId: socketId("s1"), username: "Ada" };
      await renderEditor(followed);

      execute({ username: "Ghost" });

      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: followed,
        action: "UNFOLLOW",
      });
    });

    it("emits nothing for the current user when no one is followed", async () => {
      await renderEditor();

      execute({ socketId: socketId("me"), isCurrentUser: true });

      expect(onUserFollow).not.toHaveBeenCalled();
    });

    it("throws when called without a collaborator", async () => {
      await renderEditor();

      expect(() =>
        actionGoToCollaborator.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          undefined,
          h.app,
        ),
      ).toThrow(/collaborator should be defined/);
    });
  });

  describe("PanelComponent", () => {
    beforeEach(async () => {
      await renderEditor();
    });

    it("renders a named entry that follows the collaborator on click", () => {
      const collaborator: Collaborator = {
        socketId: socketId("s1"),
        username: "Ada",
      };
      const { container } = renderPanel({
        socketId: socketId("s1"),
        collaborator,
        withName: true,
        isBeingFollowed: false,
      });

      const item = container.querySelector(".UserList__collaborator")!;
      expect(
        container.querySelector(".UserList__collaborator-name")!.textContent,
      ).toBe("Ada");
      expect(item.classList.contains("is-followed")).toBe(false);
      expect(
        container.querySelector(
          ".UserList__collaborator-status-icon-is-followed",
        ),
      ).toBe(null);

      fireEvent.click(item);

      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: { socketId: "s1", username: "Ada" },
        action: "FOLLOW",
      });
    });

    it("marks the followed collaborator and the current user", () => {
      const { container } = renderPanel({
        socketId: socketId("me"),
        collaborator: {
          socketId: socketId("me"),
          username: "Me",
          isCurrentUser: true,
        },
        withName: true,
        isBeingFollowed: true,
      });

      const item = container.querySelector(".UserList__collaborator")!;
      expect(item.classList.contains("is-followed")).toBe(true);
      expect(item.classList.contains("is-current-user")).toBe(true);
      expect(
        container.querySelector(
          ".UserList__collaborator-status-icon-is-followed",
        ),
      ).not.toBe(null);
      expect(
        container.querySelector(".UserList__collaborator-status-icons")!
          .textContent,
      ).toContain("(You)");

      // clicking yourself is a no-op
      fireEvent.click(item);
      expect(onUserFollow).not.toHaveBeenCalled();
    });

    it("shows a speaking indicator for a speaking collaborator in a call", () => {
      const { container } = renderPanel({
        socketId: socketId("s1"),
        collaborator: {
          socketId: socketId("s1"),
          username: "Ada",
          isInCall: true,
          isSpeaking: true,
        },
        withName: true,
        isBeingFollowed: false,
      });

      const item = container.querySelector(".UserList__collaborator")!;
      expect(item.classList.contains("is-in-call")).toBe(true);
      expect(item.classList.contains("is-speaking")).toBe(true);
      expect(
        container
          .querySelector(
            ".UserList__collaborator-status-icon-speaking-indicator",
          )!
          .getAttribute("title"),
      ).toBe("User is speaking");
    });

    it("shows a muted microphone for a muted collaborator in a call", () => {
      const { container } = renderPanel({
        socketId: socketId("s1"),
        collaborator: {
          socketId: socketId("s1"),
          username: "Ada",
          isInCall: true,
          isMuted: true,
        },
        withName: true,
        isBeingFollowed: false,
      });

      expect(
        container
          .querySelector(".UserList__collaborator")!
          .classList.contains("is-muted"),
      ).toBe(true);
      expect(
        container
          .querySelector(
            ".UserList__collaborator-status-icon-microphone-muted",
          )!
          .getAttribute("title"),
      ).toBe("User's microphone is muted");
    });

    it("renders an avatar-only entry with an in-call icon that follows on avatar click", () => {
      const { container } = renderPanel({
        socketId: socketId("s1"),
        collaborator: {
          socketId: socketId("s1"),
          username: "Ada",
          isInCall: true,
        },
        withName: false,
        isBeingFollowed: false,
      });

      expect(
        container.querySelector(".UserList__collaborator--avatar-only"),
      ).not.toBe(null);
      expect(container.querySelector(".UserList__collaborator-name")).toBe(
        null,
      );
      expect(
        container.querySelector(
          ".UserList__collaborator-status-icon [title='User is in a voice call']",
        ),
      ).not.toBe(null);

      fireEvent.click(container.querySelector(".Avatar")!);

      expect(onUserFollow).toHaveBeenCalledWith({
        userToFollow: { socketId: "s1", username: "Ada" },
        action: "FOLLOW",
      });
    });

    it("omits the status icon for an avatar-only collaborator not in a call", () => {
      const { container } = renderPanel({
        socketId: socketId("s1"),
        collaborator: { socketId: socketId("s1"), username: "Ada" },
        withName: false,
        isBeingFollowed: false,
      });

      expect(
        container.querySelector(".UserList__collaborator--avatar-only"),
      ).not.toBe(null);
      expect(
        container.querySelector(".UserList__collaborator-status-icon"),
      ).toBe(null);
    });
  });
});
