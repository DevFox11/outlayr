import {
    Button,
    DatePicker,
    Divider,
    HStack,
    Image,
    Menu,
    Picker,
    Spacer,
    Text as SwiftText,
    Toggle,
    VStack,
} from "@expo/ui/swift-ui";
import type { ViewModifier } from "@expo/ui/swift-ui/modifiers";
import { animation, datePickerStyle, foregroundStyle, labelsHidden, tag, tint } from "@expo/ui/swift-ui/modifiers";
import {
    Calendar03Icon,
    CalendarRemove01Icon,
    Clock01Icon,
    Notification03Icon,
    RepeatIcon,
} from "@hugeicons-pro/core-stroke-rounded";

import { menuTint } from "@/components/native/styles";

import { TransactionFormRowIcon } from "./row-icon";
import { BODY, MORPH, ROW, rowLabel } from "./style";

interface CadenceOption {
    label: string;
    type: number;
}

interface LeadOption {
    label: string;
    lead: number;
}

interface TransactionFormScheduleSectionProps {
    cadenceOptions: readonly CadenceOption[];
    card: ViewModifier[];
    customScheduleLabel: string;
    date: Date;

    dateLabel: string;
    endDate: Date;

    endDateLabel: string;

    endsLabel: string;

    firstPaymentLabel: string;
    foregroundColor: string;
    hairline: ViewModifier[];
    hasEndDate: boolean;
    incomeColor: string;
    isSubscription: boolean;
    leadDays: number | null;
    leadOffLabel: string;
    leadOffTag: number;
    leadOptions: readonly LeadOption[];
    mutedColor: string;
    onDateChange: (date: Date) => void;
    onEndDateChange: (date: Date) => void;
    onHasEndDateChange: (value: boolean) => void;
    onLeadChange: (next: number) => void;
    onOpenCustomSchedule: () => void;
    onScheduleChange: (type: number) => void;
    recurringType: number;

    remindLabel: string;
    remindMenuLabel: string;

    scheduleLabel: string;
    scheduleMenuLabel: string;
    timeLabel: string;
}

export function TransactionFormScheduleSection({
    card,
    hairline,
    foregroundColor,
    mutedColor,
    incomeColor,
    isSubscription,
    scheduleLabel,
    scheduleMenuLabel,
    cadenceOptions,
    recurringType,
    onScheduleChange,
    customScheduleLabel,
    onOpenCustomSchedule,
    firstPaymentLabel,
    date,
    onDateChange,
    endDateLabel,
    hasEndDate,
    onHasEndDateChange,
    endsLabel,
    endDate,
    onEndDateChange,
    remindLabel,
    remindMenuLabel,
    leadDays,
    leadOffTag,
    leadOffLabel,
    leadOptions,
    onLeadChange,
    dateLabel,
    timeLabel,
}: TransactionFormScheduleSectionProps) {
    return (
        <VStack modifiers={[...card, animation(MORPH, isSubscription)]} spacing={0}>
            {isSubscription ? (
                <>
                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={RepeatIcon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{scheduleLabel}</SwiftText>
                        <Spacer />
                        <Menu
                            label={
                                <HStack spacing={4}>
                                    <SwiftText modifiers={[BODY, foregroundStyle(foregroundColor)]}>
                                        {scheduleMenuLabel}
                                    </SwiftText>
                                    <Image color={mutedColor} size={12} systemName="chevron.up.chevron.down" />
                                </HStack>
                            }
                            modifiers={[menuTint]}
                        >
                            <Picker
                                label={scheduleLabel}
                                onSelectionChange={onScheduleChange}
                                selection={recurringType}
                            >
                                {cadenceOptions.map((option) => (
                                    <SwiftText key={option.type} modifiers={[tag(option.type)]}>
                                        {option.label}
                                    </SwiftText>
                                ))}
                            </Picker>
                            <Button label={customScheduleLabel} onPress={onOpenCustomSchedule} />
                        </Menu>
                    </HStack>

                    <Divider modifiers={hairline} />

                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={Calendar03Icon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{firstPaymentLabel}</SwiftText>
                        <Spacer />
                        <DatePicker
                            displayedComponents={["date"]}
                            modifiers={[datePickerStyle("compact"), labelsHidden()]}
                            onDateChange={onDateChange}
                            selection={date}
                        />
                    </HStack>

                    <Divider modifiers={hairline} />

                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={CalendarRemove01Icon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{endDateLabel}</SwiftText>
                        <Spacer />
                        <Toggle
                            isOn={hasEndDate}
                            modifiers={[tint(incomeColor), labelsHidden()]}
                            onIsOnChange={onHasEndDateChange}
                        />
                    </HStack>

                    {hasEndDate ? (
                        <>
                            <Divider modifiers={hairline} />
                            <HStack modifiers={ROW} spacing={12}>
                                <TransactionFormRowIcon color={mutedColor} icon={CalendarRemove01Icon} />
                                <SwiftText modifiers={[BODY, rowLabel]}>{endsLabel}</SwiftText>
                                <Spacer />
                                <DatePicker
                                    displayedComponents={["date"]}
                                    modifiers={[datePickerStyle("compact"), labelsHidden()]}
                                    onDateChange={onEndDateChange}
                                    selection={endDate}
                                />
                            </HStack>
                        </>
                    ) : null}

                    <Divider modifiers={hairline} />

                    {/* Label outside the Menu, as on the Schedule row above. */}
                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={Notification03Icon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{remindLabel}</SwiftText>
                        <Spacer />
                        <Menu
                            label={
                                <HStack spacing={4}>
                                    <SwiftText modifiers={[BODY, foregroundStyle(foregroundColor)]}>
                                        {remindMenuLabel}
                                    </SwiftText>
                                    <Image color={mutedColor} size={12} systemName="chevron.up.chevron.down" />
                                </HStack>
                            }
                            modifiers={[menuTint]}
                        >
                            <Picker
                                label={remindLabel}
                                onSelectionChange={onLeadChange}
                                selection={leadDays ?? leadOffTag}
                            >
                                <SwiftText modifiers={[tag(leadOffTag)]}>{leadOffLabel}</SwiftText>
                                {leadOptions.map((option) => (
                                    <SwiftText key={option.lead} modifiers={[tag(option.lead)]}>
                                        {option.label}
                                    </SwiftText>
                                ))}
                            </Picker>
                        </Menu>
                    </HStack>
                </>
            ) : (
                <>
                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={Calendar03Icon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{dateLabel}</SwiftText>
                        <Spacer />
                        <DatePicker
                            displayedComponents={["date"]}
                            modifiers={[datePickerStyle("compact"), labelsHidden()]}
                            onDateChange={onDateChange}
                            selection={date}
                        />
                    </HStack>

                    <Divider modifiers={hairline} />

                    <HStack modifiers={ROW} spacing={12}>
                        <TransactionFormRowIcon color={mutedColor} icon={Clock01Icon} />
                        <SwiftText modifiers={[BODY, rowLabel]}>{timeLabel}</SwiftText>
                        <Spacer />
                        <DatePicker
                            displayedComponents={["hourAndMinute"]}
                            modifiers={[datePickerStyle("compact"), labelsHidden()]}
                            onDateChange={onDateChange}
                            selection={date}
                        />
                    </HStack>
                </>
            )}
        </VStack>
    );
}
