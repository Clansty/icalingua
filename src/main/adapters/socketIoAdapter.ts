import Adapter from '../../types/Adapter'
import LoginForm from '../../types/LoginForm'
import Room from '../../types/Room'
import Message from '../../types/Message'
import {FileElem, GroupMessageEventData, MessageElem, PrivateMessageEventData, Ret} from 'oicq'
import IgnoreChatInfo from '../../types/IgnoreChatInfo'
import SendMessageParams from '../../types/SendMessageParams'
import {io, Socket} from 'socket.io-client'
import {getConfig} from '../utils/configManager'
import crypto from 'crypto'
import {app, dialog} from 'electron'
import {getMainWindow, loadMainWindow} from '../utils/windowManager'
import {createTray, updateTrayIcon} from '../utils/trayManager'
import ui from '../utils/ui'
import {updateAppMenu} from '../ipc/menuManager'

let socket: Socket
let uin = 0

const attachSocketEvents = () => {
    socket.on('updateRoom', (room: Room) => {
        if (room.roomId === ui.getSelectedRoomId())
            room.unreadCount = 0
        ui.updateRoom(room)
    })
    socket.on('addMessage', ({roomId, message}) => ui.addMessage(roomId, message))
    socket.on('deleteMessage', ui.deleteMessage)
    socket.on('setOnline', ui.setOnline)
    socket.on('setOffline', ui.setOffline)
    socket.on('onlineData', (data: { online: boolean, nick: string, uin: number }) => {
        uin = data.uin
        ui.sendOnlineData({
            ...data,
            priority: getConfig().priority,
        })
    })
    socket.on('setShutUp', ui.setShutUp)
    socket.on('message', ui.message)
    socket.on('messageError', ui.messageError)
    socket.on('messageSuccess', ui.messageSuccess)
    socket.on('setAllRooms', ui.setAllRooms)
    socket.on('closeLoading', ui.closeLoading)
    socket.on('notifyError', ui.notifyError)
    socket.on('revealMessage', ui.revealMessage)
    socket.on('setMessages', ({roomId, messages}: { roomId: number, messages: Message[] }) => {
        if (roomId === ui.getSelectedRoomId())
            ui.setMessages(messages)
    })
}

const adapter: Adapter = {
    addRoom(room: Room) {
        socket.emit('addRoom', room)
    },
    clearCurrentRoomUnread() {
        ui.clearCurrentRoomUnread()
        socket.emit('updateRoom', ui.getSelectedRoomId(), {unreadCount: 0})
        updateTrayIcon()
    },
    async createBot(_?: LoginForm) {
        await loadMainWindow()
        createTray()
        socket = io(getConfig().server)
        socket.on('requireAuth', (salt: string) => {
            const sign = crypto.createSign('RSA-SHA1')
            sign.update(salt)
            sign.end()
            socket.emit('auth', sign.sign(getConfig().privateKey).toString('base64'))
            console.log('已向服务端提交身份验证')
        })
        socket.once('authSucceed', attachSocketEvents)
        socket.once('authFailed', async () => {
            await dialog.showMessageBox(getMainWindow(), {
                title: '错误',
                message: '认证失败',
                type: 'error',
            })
            app.quit()
        })
        await updateAppMenu()
        await updateTrayIcon()
    },
    deleteMessage(roomId: number, messageId: string) {
        socket.emit('deleteMessage', roomId, messageId)
    },
    fetchHistory(messageId: string, roomId?: number) {
        if (!roomId)
            roomId = ui.getSelectedRoomId()
        socket.emit('fetchHistory', messageId, roomId)
    },
    fetchMessages(roomId: number, offset: number): Promise<Message[]> {
        return new Promise((resolve, reject) => {
            socket.emit('fetchMessages', roomId, offset, resolve)
        })
    },
    getFirstUnreadRoom(): Promise<Room> {
        return new Promise((resolve, reject) => {
            socket.emit('getFirstUnreadRoom', getConfig().priority, resolve)
        })
    },
    getForwardMsg(resId: string): Promise<Ret<{ group_id?: number; user_id: number; nickname: number; time: number; message: MessageElem[]; raw_message: string }[]>> {
        return new Promise((resolve, reject) => {
            socket.emit('getForwardMsg', resId, resolve)
        })
    },
    getFriendsAndGroups(): Promise<{ friendsAll: any[]; groupsAll: any[] }> {
        return new Promise((resolve, reject) => {
            socket.emit('getFriendsAndGroups', resolve)
        })
    },
    getGroupFileMeta(gin: number, fid: string): Promise<FileElem['data']> {
        return new Promise((resolve, reject) => {
            socket.emit('getGroupFileMeta', gin, fid, resolve)
        })
    },
    getRoom(roomId: number): Promise<Room> {
        return new Promise((resolve, reject) => {
            socket.emit('getRoom', roomId, resolve)
        })
    },
    getSelectedRoom(): Promise<Room> {
        return adapter.getRoom(ui.getSelectedRoomId())
    },
    getUin: () => uin,
    getUnreadCount(): Promise<number> {
        return new Promise((resolve, reject) => {
            socket.emit('getUnreadCount', getConfig().priority, resolve)
        })
    },
    ignoreChat(data: IgnoreChatInfo) {
        socket.emit('ignoreChat', data)
    },
    logOut(): void {
    },
    pinRoom(roomId: number, pin: boolean) {
        socket.emit('pinRoom', roomId, pin)
    },
    reLogin(): void {
        socket.emit('reLogin')
    },
    removeChat(roomId: number) {
        socket.emit('removeChat', roomId)
    },
    revealMessage(roomId: number, messageId: string | number) {
        socket.emit('revealMessage', roomId, messageId)
    },
    sendGroupPoke(gin: number, uin: number) {
        socket.emit('sendGroupPoke', gin, uin)
    },
    sendMessage(data: SendMessageParams) {
        if (!data.roomId && !data.room)
            data.roomId = ui.getSelectedRoomId()
        //todo 本地文件
        socket.emit('sendMessage', data)
    },
    setOnlineStatus(status: number) {
        socket.emit('setOnlineStatus', status)
    },
    setRoomAutoDownload(roomId: number, autoDownload: boolean) {
        socket.emit('setRoomAutoDownload', roomId, autoDownload)
    },
    setRoomAutoDownloadPath(roomId: number, downloadPath: string) {
        socket.emit('setRoomAutoDownloadPath', roomId, downloadPath)
    },
    setRoomPriority(roomId: number, priority: 1 | 2 | 3 | 4 | 5) {
        socket.emit('setRoomPriority', roomId, priority)
    },
    sliderLogin(ticket: string): void {
    },
    updateMessage(roomId: number, messageId: string, message: object) {
        socket.emit('updateMessage', roomId, messageId, message)
    },
    updateRoom(roomId: number, room: object) {
        socket.emit('updateRoom', roomId, room)
    },

}

export default adapter