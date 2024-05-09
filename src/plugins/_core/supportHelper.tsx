/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, SUPPORT_CHANNEL_ID } from "@utils/constants";
import { Margins } from "@utils/margins";
import { isPluginDev } from "@utils/misc";
import { makeCodeblock } from "@utils/text";
import definePlugin from "@utils/types";
import { Card, ChannelStore, Parser, RelationshipStore } from "@webpack/common";

import gitHash from "~git-hash";
import plugins from "~plugins";

import settings from "./settings";

const AllowedChannelIds = [
    SUPPORT_CHANNEL_ID,
    "1024286218801926184", // Vencord > #bot-spam
    "1033680203433660458", // Vencord > #v
];

export default definePlugin({
    name: "SupportHelper",
    required: false,
    description: "Helps us provide support to you",
    authors: [Devs.Ven],
    dependencies: ["CommandsAPI"],

    patches: [{
        find: ".BEGINNING_DM.format",
        replacement: {
            match: /BEGINNING_DM\.format\(\{.+?\}\),(?=.{0,100}userId:(\i\.getRecipientId\(\)))/,
            replace: "$& $self.ContributorDmWarningCard({ userId: $1 }),"
        }
    }],

    commands: [{
        name: "vencord-debug",
        description: "Send Vencord Debug info",
        predicate: ctx => AllowedChannelIds.includes(ctx.channel.id),
        async execute() {
            const { RELEASE_CHANNEL } = window.GLOBAL_ENV;

            const client = (() => {
                if (IS_DISCORD_DESKTOP) return `Discord Desktop v${DiscordNative.app.getVersion()}`;
                if (IS_VESKTOP) return `Vesktop v${VesktopNative.app.getVersion()}`;
                if ("armcord" in window) return `ArmCord v${window.armcord.version}`;

                // @ts-expect-error
                const name = typeof unsafeWindow !== "undefined" ? "UserScript" : "Web";
                return `${name} (${navigator.userAgent})`;
            })();

            const isApiPlugin = (plugin: string) => plugin.endsWith("API") || plugins[plugin].required;

            const enabledPlugins = Object.keys(plugins).filter(p => Vencord.Plugins.isPluginEnabled(p) && !isApiPlugin(p));

            const info = {
                Vencord:
                    `v${VERSION} • [${gitHash}](<https://github.com/Vendicated/Vencord/commit/${gitHash}>)` +
                    `${settings.additionalInfo} - ${Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(BUILD_TIMESTAMP)}`,
                Client: `${RELEASE_CHANNEL} ~ ${client}`,
                Platform: window.navigator.platform
            };

            if (IS_DISCORD_DESKTOP) {
                info["Last Crash Reason"] = (await DiscordNative.processUtils.getLastCrash())?.rendererCrashReason ?? "N/A";
            }

            const debugInfo = `
>>> ${Object.entries(info).map(([k, v]) => `**${k}**: ${v}`).join("\n")}

Enabled Plugins (${enabledPlugins.length}):
${makeCodeblock(enabledPlugins.join(", "))}
`;

            return {
                content: debugInfo.trim().replaceAll("```\n", "```")
            };
        }
    }],

    ContributorDmWarningCard: ErrorBoundary.wrap(({ userId }) => {
        if (!isPluginDev(userId)) return null;
        if (RelationshipStore.isFriend(userId)) return null;

        return (
            <Card className={`vc-plugins-restart-card ${Margins.top8}`}>
                Please do not private message Vencord plugin developers for support!
                <br />
                Instead, use the Vencord support channel: {Parser.parse("https://discord.com/channels/1015060230222131221/1026515880080842772")}
                {!ChannelStore.getChannel(SUPPORT_CHANNEL_ID) && " (Click the link to join)"}
            </Card>
        );
    }, { noop: true })
});
