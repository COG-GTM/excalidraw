import { loginIcon } from "@excalidraw/excalidraw/components/icons";
import { POINTER_EVENTS } from "@excalidraw/common";
import { useExcalidrawAppState } from "@excalidraw/excalidraw/components/App";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { AISplash } from "./splash/AISplash";
import { LauncherSplash } from "./splash/LauncherSplash";
import { TemplatesSplash } from "./splash/TemplatesSplash";

import type { SplashVariant } from "./splash/splashVariant";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
  splashVariant: SplashVariant | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = React.memo((props) => {
  const { t } = useI18n();
  const { viewModeEnabled } = useExcalidrawAppState();
  // the splashes mutate the scene through the imperative API and bypass the
  // action-level view-mode gates, so gate them here
  const splash = viewModeEnabled ? null : props.splashVariant;
  let headingContent;

  if (isExcalidrawPlusSignedUser) {
    headingContent = t("welcomeScreen.app.center_heading_plus")
      .split(/(Excalidraw\+)/)
      .map((bit, idx) => {
        if (bit === "Excalidraw+") {
          return (
            <a
              style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
              href={`${
                import.meta.env.VITE_APP_PLUS_APP
              }?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenSignedInUser`}
              key={idx}
            >
              Excalidraw+
            </a>
          );
        }
        return bit;
      });
  } else {
    headingContent = (
      <>
        {t("welcomeScreen.app.center_heading")}
        <br />
        {t("welcomeScreen.app.center_heading_line2")}
        <br />
        {t("welcomeScreen.app.center_heading_line3")}
      </>
    );
  }

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {headingContent}
        </WelcomeScreen.Center.Heading>
        {splash === "launcher" && (
          <LauncherSplash excalidrawAPI={props.excalidrawAPI} />
        )}
        <WelcomeScreen.Center.Menu>
          {splash === "templates" && (
            <TemplatesSplash excalidrawAPI={props.excalidrawAPI} />
          )}
          {splash === "ai" && <AISplash excalidrawAPI={props.excalidrawAPI} />}
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
          {!isExcalidrawPlusSignedUser && (
            <WelcomeScreen.Center.MenuItemLink
              href={`${
                import.meta.env.VITE_APP_PLUS_LP
              }/plus?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenGuest`}
              shortcut={null}
              icon={loginIcon}
            >
              {t("labels.signUp")}
            </WelcomeScreen.Center.MenuItemLink>
          )}
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
