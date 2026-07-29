import defaultPreview from "@/assets/images/app-icon-previews/default.png";
import embossPreview from "@/assets/images/app-icon-previews/emboss.png";
import hairlinePreview from "@/assets/images/app-icon-previews/hairline.png";
import inkPreview from "@/assets/images/app-icon-previews/ink.png";
import monoPreview from "@/assets/images/app-icon-previews/mono.png";
import { ChoiceRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Image } from "@/components/styled";
import { APP_ICONS } from "@/domain/app-icons";
import { alternateIconsSupported, useAppIcon } from "@/lib/app-icon";

const PREVIEW: Record<string, number> = {
	default: defaultPreview,
	emboss: embossPreview,
	hairline: hairlinePreview,
	ink: inkPreview,
	mono: monoPreview,
};

export default function AppIconScreen() {
	const { active, choose } = useAppIcon();

	// No rows at all where iOS refuses the change, rather than five that look
	// tappable and cannot take.
	if (!alternateIconsSupported) {
		return (
			<SettingsScreen>
				<SettingsSection
					footer="This device does not allow the app icon to be changed."
					title="Home screen"
				/>
			</SettingsScreen>
		);
	}

	return (
		<SettingsScreen>
			<SettingsSection
				footer="iOS confirms every change with an alert of its own."
				title="Home screen"
			>
				{APP_ICONS.map((icon) => (
					<ChoiceRow
						detail={icon.detail}
						key={icon.slug}
						label={icon.label}
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
