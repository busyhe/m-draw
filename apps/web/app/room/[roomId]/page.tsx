import { MultiplayerEditor } from '../../../components/MultiplayerEditor'

interface RoomPageProps {
  params: Promise<{
    roomId: string
  }>
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params

  return (
    <div className="fixed inset-0 overflow-hidden">
      <MultiplayerEditor roomId={roomId} />
    </div>
  )
}
