package suspend

import kotlinx.coroutines.delay
import kotlin.coroutines.*

suspend fun main() {
    println(Thread.currentThread().name)
    test1()
    println(Thread.currentThread().name)
    test2()
    println("3")
    test3()
    println("4")
    test4()
}

suspend fun test1() {
    delay(1000)
}

suspend fun test2() {
    delay(1000)
}

suspend fun test3() {
    delay(1000)
}

suspend fun test4() {
    delay(1000)
}