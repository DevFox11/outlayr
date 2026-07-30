import defaultPreview from "@/assets/images/app-icon-previews/default.png";
import embossPreview from "@/assets/images/app-icon-previews/emboss.png";
import hairlinePreview from "@/assets/images/app-icon-previews/hairline.png";
import inkPreview from "@/assets/images/app-icon-previews/ink.png";
import monoPreview from "@/assets/images/app-icon-previews/mono.png";
import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Image } from "@/components/styled";
import { APP_ICONS, type AppIconSlug } from "@/domain/app-icons";
import { useTranslation } from "@/i18n";
import { alternateIconsSupported, useAppIcon } from "@/lib/app-icon";

const PREVIEW: Record<AppIconSlug, number> = {
	default: defaultPreview,
	emboss: embossPreview,
	hairline: hairlinePreview,
	ink: inkPreview,
	mono: monoPreview,
};

export default function AppIconScreen() {
	const t = useTranslation();
	const { active, choose } = useAppIcon();

	// No rows at all where iOS refuses the change, rather than five that look
	// tappable and cannot take.
	if (!alternateIconsSupported) {
		return (
			<SettingsScreen>
				<SettingsSection
					footer={t("settings.appIcon.unsupported")}
					title={t("settings.appIcon.section")}
				/>
			</SettingsScreen>
		);
	}

	return (
		<SettingsScreen>
			<SettingsSection
				footer={t("settings.appIcon.alertNote")}
				title={t("settings.appIcon.section")}
			>
				{APP_ICONS.map((icon) => (
					<ChoiceRow
						detail={t(icon.detail)}
						key={icon.slug}
						label={t(icon.label)}
						leading={
							<Image
								className="h-11 w-11"
								contentFit="contain"
								source={PREVIEW[icon.slug]}
							/>
						}
						onPress={() => choose(icon.name)}
						selected={active === icon.name}
					/>
				))}
			</SettingsSection>
		</SettingsScreen>
	);
}
