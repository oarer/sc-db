export enum InfoColor {
	DEFAULT = 'DEFAULT',
	QUEST_ITEM = 'QUEST_ITEM',
	RANK_NEWBIE = 'RANK_NEWBIE',
	RANK_STALKER = 'RANK_STALKER',
	RANK_VETERAN = 'RANK_VETERAN',
	RANK_MASTER = 'RANK_MASTER',
	RANK_LEGEND = 'RANK_LEGEND',
	ART_QUALITY_COMMON = 'ART_QUALITY_COMMON',
	ART_QUALITY_UNCOMMON = 'ART_QUALITY_UNCOMMON',
	ART_QUALITY_SPECIAL = 'ART_QUALITY_SPECIAL',
	ART_QUALITY_RARE = 'ART_QUALITY_RARE',
	ART_QUALITY_EXCLUSIVE = 'ART_QUALITY_EXCLUSIVE',
	ART_QUALITY_LEGENDARY = 'ART_QUALITY_LEGENDARY',
	ART_QUALITY_UNIQUE = 'ART_QUALITY_UNIQUE',
}

export type Locale = 'ru' | 'en' | 'es' | 'fr' | 'ko'
export type ItemName = Partial<Record<Locale, string>>
export const LOCALE: Locale = 'ru'

export type LocalizedString = {
	[K in Locale]?: string
}

export type MessageText = {
	type: 'text'
	text: string
}

export type MessageTranslation = {
	type: 'translation'
	key: string
	args: object
	lines: { [key: string]: string }
}

export type Message = MessageText | MessageTranslation

export interface ItemEntry {
	data: string
	icon: string
	name: Message
}

export enum BindState {
	NONE = 'NONE',
	NON_DROP = 'NON_DROP',
	PERSONAL_ON_USE = 'PERSONAL_ON_USE',
	PERSONAL_ON_GET = 'PERSONAL_ON_GET',
	PERSONAL = 'PERSONAL',
	PERSONAL_UNTIL = 'PERSONAL_UNTIL',
	PERSONAL_DROP_ON_GET = 'PERSONAL_DROP_ON_GET',
	PERSONAL_DROP = 'PERSONAL_DROP',
}

export type FormattedBlock = {
	formatted?: {
		value?: LocalizedString
		nameColor?: string
		valueColor?: string
	}
}

export type FormattedBlockCompat = {
	formatted?: {
		value?: LocalizedString
		nameColor?: string
		valueColor?: string
	}
	nameColor?: string
	valueColor?: string
}

export type TextInfoBlock = {
	type: 'text'
	title: Message
	text: Message
}

export type ElementListBlock = {
	type: 'list'
	title: Message
	elements: InfoElement[]
}

export type AddStatBlock = {
	type: 'addStat'
	title: Message
	elements: InfoElement[]
}

export type PriceElement = {
	type: 'price'
	currency: string
	amount: number
} & FormattedBlockCompat

export type ItemElement = {
	type: 'item'
	name: Message
} & FormattedBlockCompat

export type TextElement = {
	type: 'text'
	text: Message
} & FormattedBlockCompat

export type StringKVElement = {
	type: 'key-value'
	key: Message
	value: Message
} & FormattedBlockCompat

export type NumericElement = {
	type: 'numeric'
	name: Message
	value: number
} & FormattedBlockCompat

export type NumericRangeElement = {
	type: 'range'
	name: Message
	key?: string
	min: number
	max: number
} & FormattedBlockCompat

export type NumericVariantsElement = {
	type: 'numericVariants'
	name: Message
	value: number[]
	nameColor?: string
	valueColor?: string
} & FormattedBlockCompat

export type Usage = {
	type: 'usage'
	name: Message
	value: number
} & FormattedBlockCompat

export type ItemRefElement = {
	type: 'item'
	id: string
} & FormattedBlockCompat

export type InfoElement =
	| PriceElement
	| ItemElement
	| ItemRefElement
	| TextElement
	| StringKVElement
	| NumericElement
	| NumericRangeElement
	| NumericVariantsElement
	| Usage

export type DamageInfoBlock = {
	type: 'damage'
	startDamage: number
	damageDecreaseStart: number
	endDamage: number
	damageDecreaseEnd: number
	maxDistance: number
} & FormattedBlock

export type InfoBlock =
	| TextInfoBlock
	| ElementListBlock
	| DamageInfoBlock
	| AddStatBlock

export type BindStateObj = {
	state: BindState
}

export interface Item {
	id: string
	category: string
	name: Message
	color: InfoColor
	status?: BindStateObj
	infoBlocks: InfoBlock[]
}
